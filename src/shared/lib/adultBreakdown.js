export const toAdultCount = (value, fallback = 0) => {
  if (value === "" || value == null) return fallback;
  const number = Math.floor(Number(value));
  return Number.isFinite(number) ? Math.max(0, number) : fallback;
};

const hasValue = (value) => value !== "" && value != null;

export const hasStoredAdultBreakdown = (male, female) => hasValue(male) || hasValue(female);

export const getAdultBreakdownError = ({
  showAdultBreakdown,
  totalAdults,
  male,
  female,
}) => {
  if (!showAdultBreakdown) return "";

  const expected = toAdultCount(totalAdults);
  const actual = toAdultCount(male) + toAdultCount(female);
  return actual === expected
    ? ""
    : `Adult Male + Adult Female must equal Total Adults (${expected}). Current total: ${actual}.`;
};

export const deriveAdultBreakdown = ({ totalAdults, male, female }, fallbackAdults = 2) => {
  const total = toAdultCount(totalAdults, fallbackAdults);
  const enabled = hasStoredAdultBreakdown(male, female);
  const maleCount = enabled ? toAdultCount(male) : null;
  const femaleCount = enabled ? toAdultCount(female) : null;

  return {
    showAdultBreakdown: enabled,
    totalAdults: total,
    male: maleCount,
    female: femaleCount,
  };
};

export const buildAdultPayload = ({
  showAdultBreakdown,
  totalAdults,
  male,
  female,
}) => ({
  totalAdults: toAdultCount(totalAdults),
  male: showAdultBreakdown ? toAdultCount(male) : null,
  female: showAdultBreakdown ? toAdultCount(female) : null,
});
