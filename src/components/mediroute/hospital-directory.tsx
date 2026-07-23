"use client";

import * as React from "react";
import { BedDouble, HeartHandshake, HeartPulse } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardDescription, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState, ErrorState, Skeleton, Spinner } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { HospitalStatusBadge } from "@/components/mediroute/status";
import { project } from "@/config/project";
import { cn } from "@/lib/utils";
import { useLocale, useT } from "@/lib/i18n/context";
import { translateApiError } from "@/lib/i18n/translate-error";
import { describeHospital } from "@/lib/mediroute/describe";
import { useDonations } from "@/lib/mediroute/use-donations";
import { useHospitals } from "@/lib/mediroute/use-hospitals";
import {
  myanmarBanks,
  myanmarPhonePattern,
  paymentMethods,
  walletMethods,
  type ApiResult,
  type Donation,
  type Hospital,
  type PaymentMethod,
} from "@/lib/mediroute/types";

const mmk = new Intl.NumberFormat("en-US");

const MAX_CHIPS = 4;

/** PaymentMethod value → the dictionary's donate.method* key. */
const METHOD_KEYS: Record<PaymentMethod, string> = {
  kbz_pay: "donate.methodKbzPay",
  aya_pay: "donate.methodAyaPay",
  wave_money: "donate.methodWaveMoney",
  cb_pay: "donate.methodCbPay",
  bank_transfer: "donate.methodBankTransfer",
  card: "donate.methodCard",
};

function HospitalCard({
  hospital,
  raised,
  onDonate,
}: {
  hospital: Hospital;
  raised?: { total: number; count: number };
  onDonate: () => void;
}) {
  const t = useT();
  const extra = hospital.specialties.length - MAX_CHIPS;

  return (
    <Card className="flex flex-col">
      <CardBody className="flex flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle>{hospital.name}</CardTitle>
          <HospitalStatusBadge hospital={hospital} />
        </div>

        <CardDescription className="flex-1">
          {describeHospital(hospital, t, (s) => t(`status.specialty.${s}`))}
        </CardDescription>

        <div className="flex flex-wrap gap-1.5">
          {hospital.specialties.slice(0, MAX_CHIPS).map((specialty) => (
            <Badge key={specialty} tone="accent">
              {t(`status.specialty.${specialty}`)}
            </Badge>
          ))}
          {extra > 0 ? <Badge>+{extra}</Badge> : null}
        </div>

        <div className="flex items-center gap-4 font-mono text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <BedDouble className="size-3.5" />
            {t("home.bedsFree", { count: hospital.available_beds })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <HeartPulse className="size-3.5" />
            {t("home.icuFree", { count: hospital.icu_beds_free })}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <p className="text-xs font-semibold text-accent-hover dark:text-accent">
            {raised
              ? t(raised.count === 1 ? "home.raisedSingular" : "home.raised", {
                  amount: mmk.format(raised.total),
                  count: raised.count,
                })
              : t("home.beFirstDonor")}
          </p>
          <Button size="sm" onClick={onDonate}>
            {t("home.donate")}
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
  const t = useT();
  const { locale } = useLocale();
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
        title: t("donate.codeSentTitle"),
        description: t("donate.codeSentDescription", { method: t(METHOD_KEYS[method]) }),
      });
    } catch (cause) {
      toast({
        tone: "danger",
        title: t("donate.codeSendFailedTitle"),
        description:
          cause instanceof Error ? translateApiError(cause.message, t, locale) : undefined,
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
      toast({ tone: "danger", title: t("donate.errorNoName") });
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      toast({ tone: "danger", title: t("donate.errorNoAmount") });
      return;
    }
    if (isWallet && !phoneValid) {
      toast({
        tone: "danger",
        title: t("donate.errorNoPhone"),
        description: t("donate.errorNoPhoneDescription"),
      });
      return;
    }
    if (isWallet && (!otpSent || otpInput.trim().length !== 6)) {
      toast({
        tone: "danger",
        title: t("donate.errorNotConfirmed"),
        description: t("donate.errorNotConfirmedDescription"),
      });
      return;
    }
    if (method === "card" && cardNumber.replace(/\D/g, "").length < 12) {
      toast({ tone: "danger", title: t("donate.errorNoCard") });
      return;
    }
    if (method === "bank_transfer" && accountNumber.replace(/\D/g, "").length < 6) {
      toast({ tone: "danger", title: t("donate.errorNoAccount") });
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
        hospitals.find((h) => h.id === hospitalId)?.short_name ?? t("donate.generalFund");
      toast({
        title: t("donate.thankYouTitle", { name: donorName.trim() }),
        description: t("donate.thankYouDescription", {
          amount: mmk.format(value),
          method: t(METHOD_KEYS[method]),
          target,
        }),
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
        title: t("donate.donationFailedTitle"),
        description:
          cause instanceof Error ? translateApiError(cause.message, t, locale) : undefined,
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
            {t("home.hospitalsTitle")}
          </h2>
          <p className="text-sm text-muted">
            {t("home.hospitalsSub", { count: hospitals.length || "the" })}
          </p>
        </div>

        <div className="mt-6">
          {error ? (
            <ErrorState message={error} onRetry={() => void reload()} />
          ) : loading ? (
            <Skeleton rows={3} />
          ) : hospitals.length === 0 ? (
            <EmptyState
              icon={<HeartPulse className="size-6" />}
              title={t("home.hospitalsEmptyTitle")}
              body={t("home.hospitalsEmptyBody")}
            />
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
              {t("donate.title")}
            </h2>
            <p className="max-w-xl text-sm leading-relaxed text-white/75">
              {t("donate.body")}
            </p>
            <ul className="flex flex-col gap-2.5 text-sm text-white/90">
              {[t("donate.bullet1"), t("donate.bullet2"), t("donate.bullet3")].map((line) => (
                <li key={line} className="flex items-center gap-2.5">
                  <HeartHandshake className="size-4 shrink-0 text-accent-soft" />
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <Card>
            <CardBody className="flex flex-col gap-4">
              <CardTitle>{t("donate.formTitle")}</CardTitle>

              <form className="flex flex-col gap-4" onSubmit={submit}>
                <Field label={t("donate.yourName")} htmlFor="donor-name">
                  <Input
                    id="donor-name"
                    value={donorName}
                    onChange={(e) => setDonorName(e.target.value)}
                    placeholder={t("donate.yourNamePlaceholder")}
                    maxLength={80}
                    required
                  />
                </Field>

                <Field label={t("donate.amount")} htmlFor="donor-amount">
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

                <Field label={t("donate.hospital")} htmlFor="donor-hospital">
                  <Select
                    id="donor-hospital"
                    value={hospitalId}
                    onChange={(e) => setHospitalId(e.target.value)}
                  >
                    <option value="">{t("donate.generalFund")}</option>
                    {hospitals.map((hospital) => (
                      <option key={hospital.id} value={hospital.id}>
                        {hospital.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-foreground">
                    {t("donate.paymentMethod")}
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
                        {t(METHOD_KEYS[option])}
                      </button>
                    ))}
                  </div>
                </div>

                {isWallet ? (
                  <div className="flex flex-col gap-3">
                    <Field
                      label={t("donate.walletPhone", { method: t(METHOD_KEYS[method]) })}
                      htmlFor="payer-phone"
                      hint={t("donate.walletPhoneHint")}
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
                          {otpSent ? t("donate.resendCode") : t("donate.sendCode")}
                        </Button>
                      </div>
                    </Field>

                    {otpSent ? (
                      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-muted/50 p-3">
                        <p className="rounded-md border border-dashed border-accent/40 bg-accent-soft/60 px-3 py-2 font-mono text-xs text-accent-hover dark:text-accent">
                          {t("donate.demoSmsPrefix", { phone: cleanPhone, name: project.name })}{" "}
                          <span className="font-semibold">{otpDemoCode}</span>
                        </p>
                        <Field
                          label={t("donate.verificationCode")}
                          htmlFor="otp-code"
                          hint={t("donate.verificationCodeHint")}
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
                    <Field label={t("donate.bankName")} htmlFor="bank-name">
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
                    <Field label={t("donate.accountNumber")} htmlFor="account-number">
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
                    <p className="text-xs text-muted">{t("donate.bankDemoNote")}</p>
                  </div>
                ) : null}

                {method === "card" ? (
                  <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-muted/50 p-3">
                    <Field label={t("donate.nameOnCard")} htmlFor="card-name">
                      <Input
                        id="card-name"
                        autoComplete="off"
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value)}
                        placeholder="DAW AYE AYE"
                        maxLength={60}
                      />
                    </Field>
                    <Field label={t("donate.cardNumber")} htmlFor="card-number">
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
                      <Field label={t("donate.expiry")} htmlFor="card-expiry">
                        <Input
                          id="card-expiry"
                          autoComplete="off"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          placeholder="12/29"
                          maxLength={5}
                        />
                      </Field>
                      <Field label={t("donate.cvc")} htmlFor="card-cvc">
                        <Input
                          id="card-cvc"
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="123"
                          maxLength={4}
                        />
                      </Field>
                    </div>
                    <p className="text-xs text-muted">{t("donate.cardDemoNote")}</p>
                  </div>
                ) : null}

                <Field label={t("donate.message")} htmlFor="donor-message">
                  <Textarea
                    id="donor-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t("donate.messagePlaceholder")}
                    maxLength={500}
                    className="min-h-16"
                  />
                </Field>

                <Button type="submit" disabled={submitting}>
                  {submitting ? <Spinner /> : null}
                  {amount && Number(amount) > 0
                    ? t("donate.submitAmount", { amount: mmk.format(Number(amount)) })
                    : t("donate.submit")}
                </Button>

                <p className="text-center text-xs text-muted">{t("donate.demoDisclaimer")}</p>
              </form>
            </CardBody>
          </Card>
        </div>
      </section>
    </>
  );
}
