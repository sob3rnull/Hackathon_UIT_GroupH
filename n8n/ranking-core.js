// ─────────────────────────────────────────────────────────────────────────
//  SINGLE SOURCE OF TRUTH for ambulance selection + hospital ranking.
//
//  This exact file is embedded verbatim into the n8n Code node, and is also
//  loaded by src/lib/mediroute/engine.test.ts, which asserts it produces
//  identical results to the TypeScript engine on the full test battery.
//
//  That parity test is the whole point: without it, the logic the tests cover
//  and the logic that actually runs in production are two different copies
//  that drift silently. If you change the ranking, change it HERE and re-run
//  `npm test`, then redeploy the workflow.
//
//  Constraints, because this runs in the n8n Code sandbox:
//    · function declarations only — no import/export, no top-level statements
//    · no network (the sandbox blocks fetch/axios); pure computation only
// ─────────────────────────────────────────────────────────────────────────

function haversineKm(a, b) {
  var R = 6371;
  var toRad = function (d) { return (d * Math.PI) / 180; };
  var dLat = toRad(b.lat - a.lat);
  var dLng = toRad(b.lng - a.lng);
  var h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) *
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat));
  return 2 * R * Math.asin(Math.sqrt(h));
}

function etaMinutes(distanceKm) {
  var ROAD_FACTOR = 1.3;
  var AVG_SPEED_KMH = 30;
  return ((distanceKm * ROAD_FACTOR) / AVG_SPEED_KMH) * 60;
}

function clamp01(n) { return Math.min(1, Math.max(0, n)); }

// Raised from 45 once real Google Routes times replaced haversine estimates:
// measured Yangon driving times run ~1.7x the straight-line guess, so 45 was
// clipping hospitals that are genuinely reachable down to a zero travel score.
var UNACCEPTABLE_MINUTES = 60;
var STALE_GPS_MINUTES = 10;
var DOCTORS_FOR_FULL_SCORE = 2;

var WEIGHTS = {
  critical: { travel: 0.5, beds: 0.2, doctors: 0.2, erLoad: 0.1 },
  urgent: { travel: 0.4, beds: 0.25, doctors: 0.2, erLoad: 0.15 },
  stable: { travel: 0.25, beds: 0.3, doctors: 0.15, erLoad: 0.3 }
};

function travelScore(minutes) {
  return clamp01(1 - minutes / UNACCEPTABLE_MINUTES);
}

function doctorCount(hospital, specialty) {
  var roster = hospital.doctors_on_duty || {};
  return roster[specialty] || 0;
}

function disqualify(hospital, triage, applyCriticalRules) {
  var specialties = hospital.specialties || [];
  if (specialties.indexOf(triage.requiredSpecialty) === -1) {
    return 'No ' + triage.requiredSpecialty + ' service';
  }
  if (!(hospital.available_beds > 0)) {
    return 'No available beds';
  }
  if (applyCriticalRules) {
    if (!(doctorCount(hospital, triage.requiredSpecialty) > 0)) {
      return 'No ' + triage.requiredSpecialty + ' specialist on duty';
    }
    if (triage.needsICU && !(hospital.icu_beds_free > 0)) {
      return 'No ICU bed free';
    }
  }
  return null;
}

function scoreOne(hospital, triage, distanceKm, eta) {
  var weights = WEIGHTS[triage.severity];
  var specialists = doctorCount(hospital, triage.requiredSpecialty);

  var parts = {
    travel: travelScore(eta),
    beds: hospital.total_beds > 0
      ? clamp01(hospital.available_beds / hospital.total_beds)
      : 0,
    doctors: clamp01(specialists / DOCTORS_FOR_FULL_SCORE),
    erLoad: hospital.er_capacity > 0
      ? clamp01(1 - hospital.current_er_queue / hospital.er_capacity)
      : 0
  };

  var score =
    weights.travel * parts.travel +
    weights.beds * parts.beds +
    weights.doctors * parts.doctors +
    weights.erLoad * parts.erLoad;

  var erPercent = hospital.er_capacity
    ? Math.round((hospital.current_er_queue / hospital.er_capacity) * 100)
    : 0;

  var reasons = [
    Math.round(eta) + ' min away (' + distanceKm.toFixed(1) + ' km)',
    hospital.available_beds + ' bed' + (hospital.available_beds === 1 ? '' : 's') + ' free',
    specialists > 0
      ? specialists + ' ' + triage.requiredSpecialty + ' specialist' + (specialists === 1 ? '' : 's') + ' on duty'
      : 'No ' + triage.requiredSpecialty + ' specialist on duty',
    'ER at ' + erPercent + '% capacity'
  ];

  if (triage.needsICU) {
    reasons.push(
      hospital.icu_beds_free > 0
        ? hospital.icu_beds_free + ' ICU bed' + (hospital.icu_beds_free === 1 ? '' : 's') + ' free'
        : 'No ICU bed free'
    );
  }

  return {
    hospital: hospital,
    score: score,
    distanceKm: distanceKm,
    etaMinutes: eta,
    parts: parts,
    reasons: reasons
  };
}

// `travel` holds real Routes API times keyed by id. Absent means fall back to
// haversine, which is what keeps this working with no network and no API key.
function recommend(hospitals, triage, origin, travel) {
  var measured = hospitals.map(function (hospital) {
    var real = travel ? travel[hospital.id] : null;
    var distanceKm = real && real.distanceKm != null
      ? real.distanceKm
      : haversineKm(origin, hospital);
    var eta = real && real.etaMinutes != null
      ? real.etaMinutes
      : etaMinutes(distanceKm);
    return { hospital: hospital, distanceKm: distanceKm, eta: eta };
  });

  var run = function (applyCriticalRules) {
    var ranked = [];
    var excluded = [];
    measured.forEach(function (m) {
      var reason = disqualify(m.hospital, triage, applyCriticalRules);
      if (reason) {
        excluded.push({
          hospital: m.hospital,
          distanceKm: m.distanceKm,
          etaMinutes: m.eta,
          reason: reason
        });
      } else {
        ranked.push(scoreOne(m.hospital, triage, m.distanceKm, m.eta));
      }
    });
    ranked.sort(function (a, b) { return b.score - a.score; });
    return { ranked: ranked, excluded: excluded };
  };

  var strict = triage.severity === 'critical';
  var result = run(strict);
  var relaxed = false;

  if (strict && result.ranked.length === 0) {
    result = run(false);
    relaxed = result.ranked.length > 0;
  }

  return {
    ranked: result.ranked,
    excluded: result.excluded,
    relaxed: relaxed,
    triage: triage,
    origin: origin
  };
}

function selectAmbulance(ambulances, incident, nowMs, travel) {
  var candidates = [];
  var rejected = [];

  ambulances.forEach(function (ambulance) {
    if (!ambulance.certified) {
      rejected.push({
        ambulance: ambulance,
        reason: ambulance.device_id
          ? 'Not certified'
          : 'No IoT unit fitted — not certified'
      });
      return;
    }

    if (ambulance.status !== 'available') {
      rejected.push({ ambulance: ambulance, reason: 'Unavailable (' + ambulance.status + ')' });
      return;
    }

    if (ambulance.lat === null || ambulance.lat === undefined ||
        ambulance.lng === null || ambulance.lng === undefined) {
      rejected.push({ ambulance: ambulance, reason: 'No GPS position reported' });
      return;
    }

    var fixAgeMinutes = ambulance.gps_fix_at
      ? (nowMs - new Date(ambulance.gps_fix_at).getTime()) / 60000
      : Infinity;

    if (!isFinite(fixAgeMinutes) || fixAgeMinutes > STALE_GPS_MINUTES) {
      rejected.push({
        ambulance: ambulance,
        reason: isFinite(fixAgeMinutes)
          ? 'GPS fix ' + Math.round(fixAgeMinutes) + ' min old'
          : 'No GPS fix timestamp'
      });
      return;
    }

    var real = travel ? travel[ambulance.id] : null;
    var distanceKm = real && real.distanceKm != null
      ? real.distanceKm
      : haversineKm(incident, { lat: ambulance.lat, lng: ambulance.lng });
    candidates.push({
      ambulance: ambulance,
      distanceKm: distanceKm,
      responseMinutes: real && real.etaMinutes != null ? real.etaMinutes : etaMinutes(distanceKm)
    });
  });

  candidates.sort(function (a, b) { return a.responseMinutes - b.responseMinutes; });

  return { candidates: candidates, rejected: rejected };
}
