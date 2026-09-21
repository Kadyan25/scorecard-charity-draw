/**
 * All money in this application is integer minor units (pence/cents).
 * Currency arithmetic lives here and nowhere else — floats never touch it.
 */

export type Cents = number;

export function assertCents(value: number, label = "amount"): Cents {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer number of cents, got ${value}`);
  }
  if (value < 0) {
    throw new Error(`${label} must not be negative, got ${value}`);
  }
  return value;
}

/** Percentage of an amount, rounded half-up to the nearest cent. */
export function percentOf(amount: Cents, percent: number): Cents {
  assertCents(amount);
  if (percent < 0 || percent > 100) {
    throw new Error(`percent must be between 0 and 100, got ${percent}`);
  }
  return Math.round((amount * percent) / 100);
}

export interface EqualSplit {
  /** What each recipient receives. */
  share: Cents;
  /** Cents that could not be divided evenly. Never discarded by callers. */
  remainder: Cents;
}

/**
 * Split an amount equally. The remainder is returned rather than absorbed so the
 * caller must decide where it goes — in this product it carries into the next
 * draw's prize pool.
 */
export function splitEqually(amount: Cents, recipients: number): EqualSplit {
  assertCents(amount);
  if (!Number.isInteger(recipients) || recipients < 0) {
    throw new Error(`recipients must be a non-negative integer, got ${recipients}`);
  }
  if (recipients === 0) {
    return { share: 0, remainder: amount };
  }
  const share = Math.floor(amount / recipients);
  return { share, remainder: amount - share * recipients };
}

export function formatCents(amount: Cents, currency = "GBP", locale = "en-GB"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amount / 100);
}
