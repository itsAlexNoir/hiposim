/**
 * Excel-equivalent financial primitives for a French / fully-amortizing
 * loan ("cuota constante") — the system every Spanish mortgage uses, and
 * the same one implemented by the seed spreadsheet's PMT/IPMT/PPMT/FV
 * formulas.
 *
 * Sign convention: Excel's PMT/IPMT/PPMT return *negative* numbers for
 * outflows, and the seed spreadsheet negates them via named ranges
 * (`Pago_Mensual = -PMT(...)`, `Interés = -IPMT(...)`, ...). Every function
 * here already returns that positive, display-ready number for positive
 * inputs, so the rest of the app never juggles signs. Each function's doc
 * comment states its raw-Excel equivalent for traceability.
 *
 * All rates are *per period* (e.g. annual/12 for a monthly schedule) —
 * callers convert with `periodicRate`.
 */

/** Per-period rate from an annual nominal rate (e.g. TIN/12 for monthly payments). */
export function periodicRate(annualRate: number, periodsPerYear: number): number {
  return annualRate / periodsPerYear;
}

/**
 * Constant payment per period for a loan of `principal` over `nper`
 * periods at per-period `rate`. Equivalent to `-PMT(rate, nper, principal)`.
 */
export function pmt(rate: number, nper: number, principal: number): number {
  if (nper <= 0) throw new RangeError("El número de periodos debe ser mayor que 0");
  if (rate === 0) return principal / nper;
  return (principal * rate) / (1 - Math.pow(1 + rate, -nper));
}

/**
 * Remaining balance after `per` payments (0..nper) of a loan that started
 * at `principal`. Equivalent to `-FV(rate, per, -pmt, principal)`, and to
 * the sheet's `Saldo_Final` when `per` = `Número_De_Pago`.
 */
export function balanceAfter(rate: number, per: number, nper: number, principal: number): number {
  const payment = pmt(rate, nper, principal);
  if (rate === 0) return principal - payment * per;
  const growth = Math.pow(1 + rate, per);
  return principal * growth - payment * ((growth - 1) / rate);
}

/**
 * Interest portion of payment number `per` (1-indexed).
 * Equivalent to `-IPMT(rate, per, nper, principal)`.
 */
export function ipmt(rate: number, per: number, nper: number, principal: number): number {
  const balanceBefore = per === 1 ? principal : balanceAfter(rate, per - 1, nper, principal);
  return balanceBefore * rate;
}

/**
 * Principal portion of payment number `per` (1-indexed).
 * Equivalent to `-PPMT(rate, per, nper, principal)`.
 */
export function ppmt(rate: number, per: number, nper: number, principal: number): number {
  return pmt(rate, nper, principal) - ipmt(rate, per, nper, principal);
}

/**
 * Loan amount ("how much can I borrow") obtainable for a given `payment`
 * over `nper` periods at per-period `rate`. Equivalent to
 * `PV(rate, nper, -payment)`. This is the closed form behind
 * "set the monthly payment, get the amount lent" in solve.ts.
 */
export function pv(rate: number, nper: number, payment: number): number {
  if (nper <= 0) throw new RangeError("El número de periodos debe ser mayor que 0");
  if (rate === 0) return payment * nper;
  return (payment * (1 - Math.pow(1 + rate, -nper))) / rate;
}

/**
 * Number of periods needed to amortize `principal` with a given `payment`
 * at per-period `rate`. Equivalent to `NPER(rate, -payment, principal)`.
 * Throws if the payment never covers even the first period's interest
 * (the loan would never amortize).
 */
export function nper(rate: number, payment: number, principal: number): number {
  if (payment <= 0) throw new RangeError("La cuota debe ser positiva");
  if (principal <= 0) throw new RangeError("El capital debe ser positivo");
  if (rate === 0) return principal / payment;
  const interestOnly = principal * rate;
  if (payment <= interestOnly) {
    throw new RangeError("payment-too-small");
  }
  return -Math.log(1 - (rate * principal) / payment) / Math.log(1 + rate);
}

/** Present value of a level `payment` stream of `nperiods` at per-period `r`. */
function pvOfPayment(r: number, nperiods: number, payment: number): number {
  if (r === 0) return payment * nperiods;
  return (payment * (1 - Math.pow(1 + r, -nperiods))) / r;
}

/**
 * Per-period interest rate implied by a known payment, term and principal.
 * No closed form exists (same as Excel's RATE) — solved by Newton-Raphson
 * with a numerical derivative, falling back to bisection.
 *
 * `pvOfPayment(r)` is continuous and strictly decreasing in `r` over
 * `(-1, ∞)`, running from `+∞` down to `0`, so a bracket of
 * `[-0.999999, 10]` (widened if needed) is *guaranteed* to contain the
 * root — the bisection fallback cannot fail to converge.
 */
export function rateFromPayment(
  nperiods: number,
  payment: number,
  principal: number,
  guess = 0.01,
): number {
  if (payment <= 0) throw new RangeError("La cuota debe ser positiva");
  if (principal <= 0) throw new RangeError("El capital debe ser positivo");
  if (nperiods <= 0) throw new RangeError("El número de periodos debe ser mayor que 0");

  const f = (r: number) => pvOfPayment(r, nperiods, payment) - principal;

  let r = guess;
  const h = 1e-6;
  for (let i = 0; i < 20; i++) {
    const fr = f(r);
    if (Math.abs(fr) < 1e-9) return r;
    const derivative = (f(r + h) - f(r - h)) / (2 * h);
    if (!Number.isFinite(derivative) || Math.abs(derivative) < 1e-12) break;
    const next = r - fr / derivative;
    if (!Number.isFinite(next) || next <= -1) break; // left the valid domain — bail to bisection
    r = next;
  }
  if (Math.abs(f(r)) < 1e-7) return r;

  let lo = -0.999999;
  let hi = 10;
  while (f(hi) > 0 && hi < 1e6) hi *= 10;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Internal rate of return (per period) of a cash-flow series
 * `[c0, c1, ..., cn]`, i.e. the `r` solving `Σ cᵢ/(1+r)ⁱ = 0`. Used for
 * TAE, where cash flows are capital received net of fees, then the cuotas.
 *
 * Newton-Raphson first, bisection fallback. The bisection bracket relies
 * on the normal mortgage cash-flow shape (one sign change: an inflow at
 * t=0, then a same-signed stream after) being monotonic in `r`; if that
 * assumption fails (multiple sign changes with no bracketed root) this
 * throws rather than returning a meaningless value.
 */
export function irr(cashflows: number[], guess = 0.01): number {
  if (cashflows.length < 2) throw new RangeError("Se necesitan al menos dos flujos de caja");

  const npv = (r: number) => cashflows.reduce((sum, cf, t) => sum + cf / Math.pow(1 + r, t), 0);

  let r = guess;
  const h = 1e-6;
  for (let i = 0; i < 50; i++) {
    const f = npv(r);
    if (Math.abs(f) < 1e-9) return r;
    const derivative = (npv(r + h) - npv(r - h)) / (2 * h);
    if (!Number.isFinite(derivative) || Math.abs(derivative) < 1e-12) break;
    const next = r - f / derivative;
    if (!Number.isFinite(next) || next <= -1) break;
    r = next;
  }
  if (Math.abs(npv(r)) < 1e-6) return r;

  let lo = -0.999999;
  let hi = 10;
  let fLo = npv(lo);
  let fHi = npv(hi);
  while (fLo * fHi > 0 && hi < 1e6) {
    hi *= 10;
    fHi = npv(hi);
  }
  if (fLo * fHi > 0) {
    throw new RangeError("No se pudo calcular la TIR: revisa los flujos de caja");
  }
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid);
    if (Math.sign(fMid) === Math.sign(fLo)) {
      lo = mid;
      fLo = fMid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}
