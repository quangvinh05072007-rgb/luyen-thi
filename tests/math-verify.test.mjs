import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyMathEquivalence, validateMathExpression, isMathVerifyAvailable } from '../server/math-verify.mjs';

test('SymPy math verification engine checks mathematical equivalence accurately', async () => {
  if (!isMathVerifyAvailable()) {
    console.log('Skipping SymPy test: runtime not available');
    return;
  }

  // 1. Fractions vs decimals (including Vietnamese decimal comma)
  const r1 = await verifyMathEquivalence(String.raw`\frac{1}{2}`, '0,5');
  assert.equal(r1.valid, true);
  assert.equal(r1.equivalent, true);

  // 2. Polynomial equivalence
  const r2 = await verifyMathEquivalence('x^2 - 1', '(x - 1)*(x + 1)');
  assert.equal(r2.valid, true);
  assert.equal(r2.equivalent, true);

  // 3. Roots and radical simplification
  const r3 = await verifyMathEquivalence(String.raw`\sqrt{8}`, String.raw`2\sqrt{2}`);
  assert.equal(r3.valid, true);
  assert.equal(r3.equivalent, true);

  // 4. Inequivalent expressions
  const r4 = await verifyMathEquivalence('2*x + 1', '2*x + 2');
  assert.equal(r4.valid, true);
  assert.equal(r4.equivalent, false);

  // 5. Expression validation
  const v1 = await validateMathExpression('x^2 + 5*x + 6');
  assert.equal(v1.valid, true);
  assert.equal(v1.is_number, false);
});
