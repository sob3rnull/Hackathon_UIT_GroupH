"use client";

import * as React from "react";
import { BedDouble, HeartHandshake, HeartPulse } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardDescription, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ErrorState, Skeleton, Spinner } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { HospitalStatusBadge } from "@/components/mediroute/status";
import { cn } from "@/lib/utils";
import { describeHospital } from "@/lib/mediroute/describe";
import { useDonations } from "@/lib/mediroute/use-donations";
import { useHospitals } from "@/lib/mediroute/use-hospitals";
import {
  myanmarBanks,
  myanmarPhonePattern,
  paymentMethodLabel,
  paymentMethods,
  walletMethods,
  type ApiResult,
  type Donation,
  type Hospital,
  type PaymentMethod,
} from "@/lib/mediroute/types";

const mmk = new Intl.NumberFormat("en-US");

const MAX_CHIPS = 4;

function HospitalCard({
  hospital,
  raised,
  onDonate,
}: {
  hospital: Hospital;
  raised?: { total: number; count: number };
  onDonate: () => void;
}) {
  const extra = hospital.specialties.length - MAX_CHIPS;

  return (
    <Card className="flex flex-col">
      <CardBody className="flex flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle>{hospital.name}</CardTitle>
          <HospitalStatusBadge hospital={hospital} />
        </div>

        <CardDescription className="flex-1">
          {describeHospital(hospital)}
        </CardDescription>

        <div className="flex flex-wrap gap-1.5">
          {hospital.specialties.slice(0, MAX_CHIPS).map((specialty) => (
            <Badge key={specialty} tone="accent">
              {specialty}
            </Badge>
          ))}
          {extra > 0 ? <Badge>+{extra}</Badge> : null}
        </div>

        <div className="flex items-center gap-4 font-mono text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <BedDouble className="size-3.5" />
            {hospital.available_beds} beds free
          </span>
          <span className="inline-flex items-center gap-1.5">
            <HeartPulse className="size-3.5" />
            {hospital.icu_beds_free} ICU free
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <p className="text-xs font-semibold text-accent-hover dark:text-accent">
            {raised
              ? `MMK ${mmk.format(raised.total)} raised · ${raised.count} donor${raised.count === 1 ? "" : "s"}`
              : "Be the first donor"}
          </p>
          <Button size="sm" onClick={onDonate}>
            Donate
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

/**
 * The public face: every hospital in the network with live status, plus the
 * demo donation flow. Donations are recorded (Supabase or in-memory) but no
 * payment is processed — the disclaimer on the form says so.
 */
export function HospitalDirectory() {
  const { hospitals, loading, error, reload } = useHospitals();
  const donations = useDonations();
  const toast = useToast();

  const [donorName, setDonorName] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [hospitalId, setHospitalId] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [method, setMethod] = React.useState<PaymentMethod>("kbz_pay");
  /** Wallet phone — the only payer detail that is actually recorded. */
  const [payerPhone, setPayerPhone] = React.useState("");
  /** Wallet confirmation: code issued for the phone, then typed back in. */
  const [otpSent, setOtpSent] = React.useState(false);
  const [otpDemoCode, setOtpDemoCode] = React.useState("");
  const [otpInput, setOtpInput] = React.useState("");
  const [sendingOtp, setSendingOtp] = React.useState(false);
  // Everything below is purely visual — never sent and never stored.
  const [bank, setBank] = React.useState<string>(myanmarBanks[0]);
  const [accountNumber, setAccountNumber] = React.useState("");
  const [cardName, setCardName] = React.useState("");
  const [cardNumber, setCardNumber] = React.useState("");
  const [cardExpiry, setCardExpiry] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const isWallet = walletMethods.includes(method);
  const cleanPhone = payerPhone.replace(/[\s-]/g, "");
  const phoneValid = myanmarPhonePattern.test(cleanPhone);

  const resetOtp = () => {
    setOtpSent(false);
    setOtpDemoCode("");
    setOtpInput("");
  };

  const sendOtp = async () => {
    setSendingOtp(true);
    try {
      const response = await fetch("/api/donations/otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone }),
      });
      const result: ApiResult<{ demo_code: string }> = await response.json();
      if (!result.ok) throw new Error(result.error);
      setOtpSent(true);
      setOtpDemoCode(result.data.demo_code);
      setOtpInput("");
      toast({
        title: "Verification code sent",
        description: `Enter the code shown in the demo SMS to confirm ${paymentMethodLabel[method]}.`,
      });
    } catch (cause) {
      toast({
        tone: "danger",
        title: "Could not send the code",
        description: cause instanceof Error ? cause.message : undefined,
      });
    } finally {
      setSendingOtp(false);
    }
  };

  const pickHospital = (id: string) => {
    setHospitalId(id);
    document.getElementById("donate")?.scrollIntoView({ behavior: "smooth" });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(amount);
    if (!donorName.trim()) {
      toast({ tone: "danger", title: "Please tell us your name" });
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      toast({ tone: "danger", title: "Please enter a valid amount" });
      return;
    }
    if (isWallet && !phoneValid) {
      toast({
        tone: "danger",
        title: "Enter the wallet's phone number",
        description: "Myanmar mobile format, e.g. 09 7700 1122",
      });
      return;
    }
    if (isWallet && (!otpSent || otpInput.trim().length !== 6)) {
      toast({
        tone: "danger",
        title: "Confirm the payment first",
        description: "Send the verification code and enter the 6 digits.",
      });
      return;
    }
    if (method === "card" && cardNumber.replace(/\D/g, "").length < 12) {
      toast({ tone: "danger", title: "Please enter a valid card number" });
      return;
    }
    if (method === "bank_transfer" && accountNumber.replace(/\D/g, "").length < 6) {
      toast({ tone: "danger", title: "Please enter the account number" });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/donations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          hospital_id: hospitalId || null,
          donor_name: donorName.trim(),
          amount: value,
          message,
          payment_method: method,
          payer_phone: isWallet ? cleanPhone : "",
          otp: isWallet ? otpInput.trim() : "",
        }),
      });
      const result: ApiResult<Donation> = await response.json();
      if (!result.ok) throw new Error(result.error);

      const target =
        hospitals.find((h) => h.id === hospitalId)?.short_name ?? "the general fund";
      toast({
        title: `Thank you, ${donorName.trim()}!`,
        description: `MMK ${mmk.format(value)} via ${paymentMethodLabel[method]} recorded for ${target}.`,
      });
      setAmount("");
      setMessage("");
      setPayerPhone("");
      resetOtp();
      setAccountNumber("");
      setCardName("");
      setCardNumber("");
      setCardExpiry("");
      void donations.reload();
    } catch (cause) {
      toast({
        tone: "danger",
        title: "Donation failed",
        description: cause instanceof Error ? cause.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* ── Directory ──────────────────────────────────────────────────── */}
      <section id="hospitals" className="mx-auto w-full max-w-7xl px-5 py-12">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold tracking-tight">
            Hospitals in the network
          </h2>
          <p className="text-sm text-muted">
            Live capacity from {hospitals.length || "the"} Yangon hospitals.
            Donations go toward beds, supplies and ambulance readiness.
          </p>
        </div>

        <div className="mt-6">
          {error ? (
            <ErrorState message={error} onRetry={() => void reload()} />
          ) : loading ? (
            <Skeleton rows={3} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {hospitals.map((hospital) => (
                <HospitalCard
                  key={hospital.id}
                  hospital={hospital}
                  raised={donations.summary?.totals[hospital.id]}
                  onDonate={() => pickHospital(hospital.id)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Donate ─────────────────────────────────────────────────────── */}
      <section id="donate" className="bg-accent-deep">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-14 lg:grid-cols-[1fr_26rem] lg:items-center">
          <div className="flex flex-col gap-4 text-white">
            <h2 className="text-3xl font-semibold tracking-tight">
              Your support keeps ambulances moving
            </h2>
            <p className="max-w-xl text-sm leading-relaxed text-white/75">
              Every donation helps a hospital keep beds open, restock emergency
              supplies and stay ready for the next call. Pick a hospital — or
              give to the general fund and we&apos;ll route it where the need
              is greatest.
            </p>
            <ul className="flex flex-col gap-2.5 text-sm text-white/90">
              {[
                "100% goes to the hospital you choose",
                "Live totals shown on every hospital card",
                "Demo only — no real payment is processed",
              ].map((line) => (
                <li key={line} className="flex items-center gap-2.5">
                  <HeartHandshake className="size-4 shrink-0 text-accent-soft" />
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <Card>
            <CardBody className="flex flex-col gap-4">
              <CardTitle>Make a donation</CardTitle>

              <form className="flex flex-col gap-4" onSubmit={submit}>
                <Field label="Your name" htmlFor="donor-name">
                  <Input
                    id="donor-name"
                    value={donorName}
                    onChange={(e) => setDonorName(e.target.value)}
                    placeholder="Daw Aye Aye"
                    maxLength={80}
                    required
                  />
                </Field>

                <Field label="Amount (MMK)" htmlFor="donor-amount">
                  <Input
                    id="donor-amount"
                    type="number"
                    min={1}
                    step="any"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="50,000"
                    required
                  />
                </Field>

                <Field label="Hospital" htmlFor="donor-hospital">
                  <Select
                    id="donor-hospital"
                    value={hospitalId}
                    onChange={(e) => setHospitalId(e.target.value)}
                  >
                    <option value="">General fund</option>
                    {hospitals.map((hospital) => (
                      <option key={hospital.id} value={hospital.id}>
                        {hospital.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">
                    Payment method
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {paymentMethods.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          setMethod(option);
                          resetOtp();
                        }}
                        aria-pressed={method === option}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors",
                          method === option
                            ? "border-accent bg-accent-soft text-accent-hover dark:text-accent"
                            : "border-border bg-background text-muted hover:border-accent/40 hover:text-foreground",
                        )}
                      >
                        {paymentMethodLabel[option]}
                      </button>
                    ))}
                  </div>
                </div>

                {isWallet ? (
                  <div className="flex flex-col gap-3">
                    <Field
                      label={`${paymentMethodLabel[method]} phone number`}
                      htmlFor="payer-phone"
                      hint="The Myanmar mobile number the wallet is registered to."
                    >
                      <div className="flex gap-2">
                        <Input
                          id="payer-phone"
                          type="tel"
                          inputMode="tel"
                          value={payerPhone}
                          onChange={(e) => {
                            setPayerPhone(e.target.value);
                            resetOtp();
                          }}
                          placeholder="09 7700 1122"
                          maxLength={15}
                          required
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => void sendOtp()}
                          disabled={!phoneValid || sendingOtp}
                          className="shrink-0"
                        >
                          {sendingOtp ? <Spinner /> : null}
                          {otpSent ? "Resend code" : "Send code"}
                        </Button>
                      </div>
                    </Field>

                    {otpSent ? (
                      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-muted/50 p-3">
                        <p className="rounded-md border border-dashed border-accent/40 bg-accent-soft/60 px-3 py-2 font-mono text-xs text-accent-hover dark:text-accent">
                          Demo SMS to {cleanPhone}: your MediRoute code is{" "}
                          <span className="font-semibold">{otpDemoCode}</span>
                        </p>
                        <Field
                          label="Verification code"
                          htmlFor="otp-code"
                          hint="Enter the 6-digit code to confirm the payment. Expires in 5 minutes."
                        >
                          <Input
                            id="otp-code"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            value={otpInput}
                            onChange={(e) => setOtpInput(e.target.value)}
                            placeholder="123456"
                            maxLength={6}
                          />
                        </Field>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {method === "bank_transfer" ? (
                  <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-muted/50 p-3">
                    <Field label="Bank" htmlFor="bank-name">
                      <Select
                        id="bank-name"
                        value={bank}
                        onChange={(e) => setBank(e.target.value)}
                      >
                        {myanmarBanks.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Account number" htmlFor="account-number">
                      <Input
                        id="account-number"
                        inputMode="numeric"
                        autoComplete="off"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        placeholder="123 456 789 012"
                        maxLength={24}
                      />
                    </Field>
                    <p className="text-xs text-muted">
                      Demo — bank details never leave this page and are not stored.
                    </p>
                  </div>
                ) : null}

                {method === "card" ? (
                  <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-muted/50 p-3">
                    <Field label="Name on card" htmlFor="card-name">
                      <Input
                        id="card-name"
                        autoComplete="off"
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        placeholder="DAW AYE AYE"
                        maxLength={60}
                      />
                    </Field>
                    <Field label="Card number" htmlFor="card-number">
                      <Input
                        id="card-number"
                        inputMode="numeric"
                        autoComplete="off"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        placeholder="4242 4242 4242 4242"
                        maxLength={23}
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Expiry" htmlFor="card-expiry">
                        <Input
                          id="card-expiry"
                          autoComplete="off"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          placeholder="12/29"
                          maxLength={5}
                        />
                      </Field>
                      <Field label="CVC" htmlFor="card-cvc">
                        <Input
                          id="card-cvc"
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="123"
                          maxLength={4}
                        />
                      </Field>
                    </div>
                    <p className="text-xs text-muted">
                      Demo — card details never leave this page and are not stored.
                    </p>
                  </div>
                ) : null}

                <Field label="Message (optional)" htmlFor="donor-message">
                  <Textarea
                    id="donor-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Stay strong!"
                    maxLength={500}
                    className="min-h-16"
                  />
                </Field>

                <Button type="submit" disabled={submitting}>
                  {submitting ? <Spinner /> : null}
                  {amount && Number(amount) > 0
                    ? `Donate MMK ${mmk.format(Number(amount))}`
                    : "Donate"}
                </Button>

                <p className="text-center text-xs text-muted">
                  Demo only — no real payment is processed.
                </p>
              </form>
            </CardBody>
          </Card>
        </div>
      </section>
    </>
  );
}
