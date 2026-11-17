"use client";

import { useActionState } from "react";

import {
  createFirstFarm,
  type OnboardingActionState,
} from "@/app/[locale]/actions";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

import { SubmitButton } from "./submit-button";

type OnboardingFormProps = {
  locale: Locale;
  defaultFullName: string;
};

const initialState: OnboardingActionState = { message: null };

export function OnboardingForm({ locale, defaultFullName }: OnboardingFormProps) {
  const dictionary = getDictionary(locale);
  const [state, formAction] = useActionState(createFirstFarm, initialState);

  return (
    <form action={formAction} className="onboarding-form">
      <input name="locale" type="hidden" value={locale} />
      <div className="form-field">
        <label htmlFor="fullName">{dictionary.onboarding.fullName}</label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          autoComplete="name"
          defaultValue={defaultFullName}
          minLength={2}
          maxLength={120}
          required
        />
      </div>
      <div className="form-field">
        <label htmlFor="farmName">{dictionary.onboarding.farmName}</label>
        <input
          id="farmName"
          name="farmName"
          type="text"
          autoComplete="organization"
          placeholder={dictionary.onboarding.farmPlaceholder}
          minLength={2}
          maxLength={120}
          required
        />
        <span className="field-hint">{dictionary.onboarding.farmHint}</span>
      </div>
      {state.message ? (
        <p className="form-message error" role="alert">
          {state.message}
        </p>
      ) : null}
      <SubmitButton pendingLabel={dictionary.onboarding.submitting}>
        {dictionary.onboarding.submit}
      </SubmitButton>
    </form>
  );
}
