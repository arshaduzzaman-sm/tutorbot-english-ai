"""Deterministic helpers shared by evaluators (SPEC 6.1.4: scores from signals, not the LLM)."""

from app.ai.interfaces.types import Band

BAND_THRESHOLDS: list[tuple[float, Band]] = [(0.85, "strong"), (0.65, "good"), (0.4, "developing")]


def ratio_to_band(ratio: float) -> Band:
    for threshold, band in BAND_THRESHOLDS:
        if ratio >= threshold:
            return band
    return "needs_work"


def word_accuracy(reference: str, spoken: str) -> dict[str, int | float]:
    """Word-level alignment (Levenshtein on words): accuracy, omissions, insertions, substitutions."""
    ref = reference.lower().split()
    hyp = spoken.lower().split()
    ref = [w.strip(".,!?;:\"'") for w in ref]
    hyp = [w.strip(".,!?;:\"'") for w in hyp]
    n, m = len(ref), len(hyp)
    dp = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        dp[i][0] = i
    for j in range(m + 1):
        dp[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost = 0 if ref[i - 1] == hyp[j - 1] else 1
            dp[i][j] = min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    i, j, om, ins, sub = n, m, 0, 0, 0
    while i > 0 or j > 0:
        if i > 0 and j > 0 and dp[i][j] == dp[i - 1][j - 1] + (0 if ref[i - 1] == hyp[j - 1] else 1):
            sub += 0 if ref[i - 1] == hyp[j - 1] else 1
            i, j = i - 1, j - 1
        elif i > 0 and dp[i][j] == dp[i - 1][j] + 1:
            om += 1
            i -= 1
        else:
            ins += 1
            j -= 1
    correct = n - om - sub
    return {
        "accuracy": round(correct / n, 4) if n else 0.0,
        "omissions": om,
        "insertions": ins,
        "substitutions": sub,
        "reference_words": n,
    }
