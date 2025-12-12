# build_rarity_map_thresholds.py
import json, math
from wordfreq import zipf_frequency

# CONFIG
WORDLIST_FILE = "wordlist.txt"
OUT_JSON = "rarity_map.json"
DROP_COMMON_IN_OUTPUT = False      # keep JSON small by omitting 'common' entries

# New numeric bucket boundaries (your requested scheme, with 5+ => legendary)
# We use half-open intervals: [low, high)
BUCKET_BOUNDS = [
    ("common",    -1e9, 3.0),   # score < 2
    ("uncommon",   3.0, 4.0),   # 2 <= score < 3
    ("rare",       4.0, 5.0),   # 3 <= score < 4
    ("epic",       5.0, 6.0),   # 4 <= score < 5
    ("legendary",  6.0, 1e9),   # score >= 5
]

def bucket_for_score(s):
    """Return bucket name for numeric score s using BUCKET_BOUNDS."""
    for name, low, high in BUCKET_BOUNDS:
        if s >= low and s < high:
            return name
    # fallback
    return "common"

def main():
    # load words
    with open(WORDLIST_FILE, "r", encoding="utf8") as f:
        words = [w.strip().lower() for w in f if w.strip()]
    if not words:
        print("No words found in", WORDLIST_FILE)
        return

    # compute zipf for each word
    zipfs = {}
    for w in words:
        try:
            z = zipf_frequency(w, "en")
        except Exception:
            z = 0.0
        zipfs[w] = z

    # compute numeric score = max_zipf - zipf  (higher => rarer)
    max_z = max(zipfs.values()) if zipfs else 1.0
    scores = {w: (max_z - zipfs.get(w, 0.0)) for w in words}

    # build output map and counts
    out_map = {}
    counts = {"common":0,"uncommon":0,"rare":0,"epic":0,"legendary":0}
    for w in words:
        s = scores[w]
        bucket = bucket_for_score(s)
        counts[bucket] += 1
        entry = {"score": s, "zipf": zipfs.get(w, 0.0), "bucket": bucket}
        if DROP_COMMON_IN_OUTPUT and bucket == "common":
            continue
        out_map[w] = entry

    out = {"thresholds": {b[0]: (b[1], b[2]) for b in BUCKET_BOUNDS}, "map": out_map}
    with open(OUT_JSON, "w", encoding="utf8") as o:
        json.dump(out, o, separators=(",", ":"), ensure_ascii=False)

    # diagnostics
    total = len(words)
    kept = len(out_map)
    print(f"Wrote {OUT_JSON} ({kept} entries kept; total words {total})")
    print("Bucket counts:", counts)
    # Print a few example words per bucket to sanity-check
    samples = {k: [] for k in counts}
    for w in words:
        b = bucket_for_score(scores[w])
        if len(samples[b]) < 6:
            samples[b].append((w, scores[w], zipfs.get(w, 0.0)))
    print("Samples (word, score, zipf) per bucket:")
    for k in samples:
        print(k, samples[k])

if __name__ == "__main__":
    main()
