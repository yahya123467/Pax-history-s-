#!/usr/bin/env python3
"""Original score for "5,000 Years in 60 Seconds".

Everything is synthesised here from scratch (no samples): 80 BPM, one bar = 3 s,
twenty bars. The arrangement moves from a lone plucked string and frame drums
to strings, machines and electronics, and lands in D major — in step with the
film. City "ignitions" are read from out/cues.json so chimes land on the lights.

    python3 scripts/score.py   ->  out/score.wav  (48 kHz stereo, 24-bit)
"""

import json
import os
import wave

import numpy as np
from pedalboard import Compressor, HighShelfFilter, Limiter, LowShelfFilter, Pedalboard
from scipy.signal import butter, fftconvolve, resample_poly, sosfilt

SR = 48000
DUR = 60.0
N = int(SR * DUR)
BEAT = 0.75
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
rng = np.random.default_rng(1206)

NOTE_IDX = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def hz(name):
    """'D4' / 'F#5' / 'Bb2' -> frequency (A4 = 440)."""
    letter, rest = name[0], name[1:]
    acc = 0
    while rest[0] in "#b":
        acc += 1 if rest[0] == "#" else -1
        rest = rest[1:]
    midi = 12 * (int(rest) + 1) + NOTE_IDX[letter] + acc
    return 440.0 * 2 ** ((midi - 69) / 12)


def T(bar, beat=0.0):
    """Seconds at (1-based) bar and beat."""
    return ((bar - 1) * 4 + beat) * BEAT


# ── Filters ───────────────────────────────────────────────────────────────
def lp(x, fc, order=2):
    return sosfilt(butter(order, min(fc, SR * 0.45), "low", fs=SR, output="sos"), x, axis=0)


def hp(x, fc, order=2):
    return sosfilt(butter(order, fc, "high", fs=SR, output="sos"), x, axis=0)


def bp(x, f0, f1, order=2):
    return sosfilt(butter(order, [f0, min(f1, SR * 0.45)], "band", fs=SR, output="sos"), x, axis=0)


def tarr(dur):
    return np.arange(int(dur * SR)) / SR


def fade(x, a=0.005, r=0.01):
    """Short linear fades to avoid clicks."""
    n = len(x)
    na, nr = min(int(a * SR), n // 2), min(int(r * SR), n // 2)
    if na:
        x[:na] *= np.linspace(0, 1, na)
    if nr:
        x[-nr:] *= np.linspace(1, 0, nr)
    return x


# ── Instruments (mono unless noted) ───────────────────────────────────────
def pluck(f, dur, bright=1.0, damp=1.0, inharm=0.00012, attack_noise=0.25):
    """Harp / lute-like tone: decaying harmonics, the high ones dying first."""
    t = tarr(dur)
    out = np.zeros_like(t)
    hmax = int(min(28, (SR * 0.42) / f))
    for h in range(1, hmax + 1):
        amp = (1.0 / h ** (1.9 - 0.75 * bright)) * (1 + 0.5 * np.sin(h * 1.7))
        decay = damp * (1.1 + 0.42 * h + 0.03 * h * h)
        fh = f * h * np.sqrt(1 + inharm * h * h)
        out += amp * np.exp(-t * decay) * np.sin(2 * np.pi * fh * t + rng.uniform(0, 0.4))
    click = bp(rng.standard_normal(len(t)), f * 1.5, f * 7) * np.exp(-t * 85) * attack_noise
    out = (out + click) * (1 - np.exp(-t * 900))
    return fade(out, 0.001, 0.03)


def bell(f, dur, soft=1.0):
    """Small glassy chime."""
    t = tarr(dur)
    out = np.zeros_like(t)
    for ratio, amp, dec in [(1, 1, 2.2), (2.0, 0.42, 3.4), (2.76, 0.3, 4.8), (5.4, 0.16, 8.0), (8.93, 0.07, 13.0)]:
        if f * ratio < SR * 0.4:
            out += amp * np.exp(-t * dec * soft) * np.sin(2 * np.pi * f * ratio * t)
    return fade(out * (1 - np.exp(-t * 700)), 0.001, 0.03)


def saw(f, t, phase=0.0):
    return 2 * ((f * t + phase) % 1.0) - 1


def pad(freqs, dur, attack=0.7, release=1.0, cutoff=1500, voices=5, detune=0.005, air=0.0):
    """Warm string-like pad. Returns stereo (n, 2)."""
    n = int((dur + release) * SR)
    t = np.arange(n) / SR
    L = np.zeros(n)
    R = np.zeros(n)
    for f in freqs:
        for v in range(voices):
            d = 1 + detune * (v - (voices - 1) / 2) / max(1, (voices - 1) / 2) + rng.uniform(-0.0006, 0.0006)
            vib = 1 + 0.0016 * np.sin(2 * np.pi * rng.uniform(4.2, 5.6) * t + rng.uniform(0, 6.28))
            ph = np.cumsum(f * d * vib) / SR + rng.uniform(0, 1)
            s = 2 * (ph % 1.0) - 1
            p = v / max(1, voices - 1)
            L += s * np.cos(p * np.pi / 2)
            R += s * np.sin(p * np.pi / 2)
    x = np.stack([L, R], axis=1) / (len(freqs) * voices) ** 0.5
    x = lp(x, cutoff, 2)
    if air:
        x += hp(lp(x, cutoff * 3, 1), cutoff, 1) * air
    env = np.ones(n)
    na = int(attack * SR)
    env[:na] = np.sin(np.linspace(0, np.pi / 2, na)) ** 2
    nr = int(release * SR)
    env[-nr:] *= np.cos(np.linspace(0, np.pi / 2, nr)) ** 2
    return x * env[:, None]


def flute(f, dur, vib_depth=0.006):
    t = tarr(dur + 0.25)
    vib = 1 + vib_depth * np.sin(2 * np.pi * 5.2 * t) * np.clip((t - 0.25) / 0.4, 0, 1)
    ph = 2 * np.pi * np.cumsum(f * vib) / SR
    tone = np.sin(ph) + 0.28 * np.sin(2 * ph + 0.3) + 0.09 * np.sin(3 * ph) + 0.035 * np.sin(4 * ph)
    breath = bp(rng.standard_normal(len(t)), f * 0.9, f * 3.2) * 0.22
    env = np.minimum(1, t / 0.09) * np.clip((dur + 0.25 - t) / 0.25, 0, 1)
    env *= 0.86 + 0.14 * np.sin(2 * np.pi * 5.2 * t + 1.0)
    return (tone + breath * (0.6 + 0.4 * np.exp(-t * 9))) * env


def horn(f, dur, cutoff=1100, attack=0.12):
    """Mellow brass: filtered saw + sine body, slight swell."""
    t = tarr(dur + 0.3)
    x = np.zeros_like(t)
    for d in (0.997, 1.0, 1.003):
        x += saw(f * d, t, rng.uniform(0, 1))
    x = lp(x / 3, cutoff, 2) + 0.5 * np.sin(2 * np.pi * f * t)
    env = np.minimum(1, t / attack) ** 1.4 * np.clip((dur + 0.3 - t) / 0.3, 0, 1)
    env *= 0.8 + 0.2 * np.minimum(1, t / max(dur * 0.6, 0.01))
    return x * env


def stab(f, dur, cutoff=1800):
    """Short bowed/staccato string note."""
    t = tarr(dur + 0.12)
    x = np.zeros_like(t)
    for d in (0.996, 1.0, 1.004):
        x += saw(f * d, t, rng.uniform(0, 1))
    x = lp(x / 3, cutoff, 2)
    env = np.minimum(1, t / 0.012) * np.exp(-t / (dur * 0.55)) * np.clip((dur + 0.12 - t) / 0.12, 0, 1)
    return x * env


def synth_pluck(f, dur, cutoff=2600):
    """Modern, glassy synth pluck for the electric age."""
    t = tarr(dur + 0.1)
    x = 0.6 * saw(f, t) + 0.4 * np.sign(np.sin(2 * np.pi * f * 1.002 * t)) * 0.6
    bright = lp(x, cutoff, 2)
    dark = lp(x, cutoff * 0.3, 2)
    k = np.exp(-t * 14)
    x = bright * k + dark * (1 - k)
    env = np.minimum(1, t / 0.004) * np.exp(-t / (dur * 0.5)) * np.clip((dur + 0.1 - t) / 0.1, 0, 1)
    return x * env


def bass(f, dur, attack=0.03, grit=0.35):
    t = tarr(dur + 0.2)
    x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) + grit * lp(saw(f, t), 320, 2)
    env = np.minimum(1, t / attack) * np.clip((dur + 0.2 - t) / 0.2, 0, 1)
    return x * env


def taiko(pitch=62.0, decay=0.42, tone=1.0, noise=0.5):
    t = tarr(decay * 4)
    f = pitch * (1 + 1.6 * np.exp(-t * 34))
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / decay)
    skin = np.sin(2 * np.pi * pitch * 2.35 * t) * np.exp(-t / (decay * 0.3)) * 0.35 * tone
    thwack = lp(rng.standard_normal(len(t)), 4200, 2) * np.exp(-t * 60) * noise * 1.3
    return fade(body + skin + thwack, 0.0008, 0.05)


def tek(f=520.0, decay=0.06):
    t = tarr(decay * 5)
    x = np.sin(2 * np.pi * f * (1 + 0.5 * np.exp(-t * 80)) * t) * np.exp(-t / decay)
    x += bp(rng.standard_normal(len(t)), 1800, 6500) * np.exp(-t / (decay * 0.5)) * 0.7
    return fade(x, 0.0005, 0.01)


def tick(f=4200.0):
    t = tarr(0.05)
    x = np.sin(2 * np.pi * f * t) * 0.6 + np.sin(2 * np.pi * f * 1.48 * t) * 0.4
    x += hp(rng.standard_normal(len(t)), 5000) * 0.6
    return fade(x * np.exp(-t * 130), 0.0003, 0.005)


def anvil(f=640.0, decay=0.45):
    t = tarr(decay * 3.5)
    x = np.zeros_like(t)
    for ratio, amp, dec in [(1, 1, 1), (1.51, 0.7, 1.3), (2.33, 0.55, 1.9), (3.47, 0.4, 2.6), (4.9, 0.25, 3.6)]:
        x += amp * np.sin(2 * np.pi * f * ratio * t + rng.uniform(0, 6)) * np.exp(-t * dec / decay)
    x += hp(rng.standard_normal(len(t)), 3000) * np.exp(-t * 90) * 0.5
    return fade(x, 0.0005, 0.03)


def kick(pitch=48.0, decay=0.2):
    t = tarr(decay * 4)
    f = pitch * (1 + 3.2 * np.exp(-t * 42))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / decay)
    x += lp(rng.standard_normal(len(t)), 3000) * np.exp(-t * 180) * 0.25
    return fade(x, 0.0005, 0.03)


def clap(decay=0.11):
    t = tarr(decay * 4)
    x = bp(rng.standard_normal(len(t)), 900, 5200)
    env = np.exp(-t / decay) * (1 + 0.8 * np.sin(2 * np.pi * 90 * t) * np.exp(-t * 60))
    return fade(x * env, 0.0005, 0.02)


def boom(pitch=38.0, decay=1.3):
    t = tarr(decay * 3.5)
    f = pitch * (1 + 1.3 * np.exp(-t * 9))
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / decay)
    x += lp(rng.standard_normal(len(t)), 400, 2) * np.exp(-t * 6) * 0.5
    return fade(x, 0.002, 0.2)


def crash(decay=1.6):
    t = tarr(decay * 3)
    x = hp(rng.standard_normal(len(t)), 3500, 2) + bp(rng.standard_normal(len(t)), 700, 4000) * 0.5
    return fade(x * np.exp(-t / decay) * (1 - np.exp(-t * 400)), 0.001, 0.3)


# A bank of band-limited noises for sweeps ("whooshes" and risers).
_BANDS = np.geomspace(140, 9500, 22)
_BANK = None


def _bank(n):
    global _BANK
    if _BANK is None or _BANK.shape[1] < n:
        base = rng.standard_normal(max(n, int(4.5 * SR)))
        _BANK = np.stack([bp(base, fc / 1.22, fc * 1.22, 2) for fc in _BANDS])
    return _BANK[:, :n]


def sweep(dur, f0, f1, shape="rise", width=0.55):
    """Noise with a moving spectral centre. shape: rise | fall | swell."""
    n = int(dur * SR)
    t = np.arange(n) / n
    fc = f0 * (f1 / f0) ** t
    bank = _bank(n)
    w = np.exp(-0.5 * ((np.log(_BANDS)[:, None] - np.log(fc)[None, :]) / width) ** 2)
    x = (bank * w).sum(axis=0)
    if shape == "rise":
        env = t ** 2.2
    elif shape == "fall":
        env = (1 - t) ** 1.6
    else:
        env = np.sin(np.pi * t) ** 2
    return fade(x * env, 0.01, 0.02)


# ── Mixer ─────────────────────────────────────────────────────────────────
class Stem:
    """A stereo bus with its own reverb send."""

    def __init__(self):
        self.dry = np.zeros((N, 2))
        self.send = np.zeros((N, 2))

    def add(self, sig, t, gain=1.0, pan=0.0, send=0.25):
        i = int(round(t * SR))
        if i >= N or i + len(sig) <= 0:
            return
        if i < 0:
            sig = sig[-i:]
            i = 0
        sig = sig[: N - i]
        if sig.ndim == 1:
            a = (pan + 1) * np.pi / 4
            st = np.stack([sig * np.cos(a), sig * np.sin(a)], axis=1)
        else:
            st = sig
        self.dry[i : i + len(sig)] += st * gain
        self.send[i : i + len(sig)] += st * gain * send


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)


def make_ir(t60=3.1):
    n = int(t60 * 1.15 * SR)
    t = np.arange(n) / SR
    ir = np.zeros((n, 2))
    for ch in range(2):
        noise = rng.standard_normal(n)
        low = lp(noise, 380, 2) * np.exp(-6.91 * t / (t60 * 1.1)) * 0.9
        mid = bp(noise, 380, 3600, 2) * np.exp(-6.91 * t / t60)
        high = hp(noise, 3600, 2) * np.exp(-6.91 * t / (t60 * 0.42)) * 0.7
        ir[:, ch] = low + mid + high
    ir *= np.minimum(1, t / 0.012)[:, None]            # soft onset
    pre = int(0.022 * SR)
    ir = np.concatenate([np.zeros((pre, 2)), ir])
    for d, g in [(0.011, 0.5), (0.017, -0.4), (0.029, 0.33), (0.041, -0.27)]:   # early reflections
        ir[int(d * SR), 0] += g
        ir[int(d * 1.13 * SR), 1] += g
    return ir / np.sqrt((ir ** 2).sum(axis=0)).mean()


# ── Harmony ───────────────────────────────────────────────────────────────
CHORDS = {
    "Dm": ["D3", "A3", "D4", "F4", "A4"],
    "Bbmaj7": ["Bb2", "F3", "A3", "D4", "F4"],
    "Cadd9": ["C3", "G3", "D4", "E4", "G4"],
    "F": ["F2", "C3", "F3", "A3", "C4", "F4"],
    "Gm": ["G2", "D3", "G3", "Bb3", "D4"],
    "Bb": ["Bb2", "F3", "Bb3", "D4", "F4"],
    "C": ["C3", "G3", "C4", "E4", "G4"],
    "A": ["A2", "E3", "A3", "C#4", "E4"],
    "D": ["D2", "A2", "D3", "F#3", "A3", "D4", "F#4", "A4"],
    "D5": ["D2", "A2", "D3", "A3"],
}
#        bar: (chord, bass note)
BARS = {
    1: ("D5", "D1"), 2: ("D5", "D1"), 3: ("Dm", "D2"), 4: ("Dm", "D2"), 5: ("Bbmaj7", "Bb1"), 6: ("Cadd9", "C2"),
    7: ("Dm", "D2"), 8: ("F", "F1"), 9: ("Gm", "G1"), 10: ("Bb", "Bb1"), 11: ("Dm", "D2"), 12: ("C", "C2"),
    13: ("F", "F1"), 14: ("C", "C2"), 15: ("Gm", "G1"), 16: ("A", "A1"), 17: ("Bb", "Bb1"), 18: ("C", "C2"),
    19: ("D", "D1"), 20: ("D", "D1"),
}


def build():
    stems = {k: Stem() for k in ["drone", "pad", "bass", "lead", "arp", "ost", "drums", "chimes", "fx", "late"]}
    S = stems

    # ── Drone & air (prelude, and under everything) ─────────────────────
    t = np.arange(N) / SR
    drone = np.sin(2 * np.pi * hz("D1") * t) * 0.9 + np.sin(2 * np.pi * hz("D2") * t + 0.4) * 0.5
    drone += lp(saw(hz("D2") * 1.002, t), 190, 2) * 0.45 + lp(saw(hz("A2") * 0.998, t), 260, 2) * 0.2
    drone += lp(saw(hz("D3") * 1.003, t) + saw(hz("A3") * 0.997, t) * 0.7, 520, 2) * 0.3
    drone *= 0.82 + 0.18 * np.sin(2 * np.pi * 0.11 * t)
    env = np.interp(t, [0, 2.2, 6, 11, 14, 54, 57, 60], [0, 1, 1, 0.75, 0.0, 0.0, 0.55, 0.0])
    S["drone"].add(drone * env, 0, 1.0, 0, send=0.3)
    air = bp(rng.standard_normal(N), 420, 2600, 1) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.07 * t + 1))
    air_r = bp(rng.standard_normal(N), 420, 2600, 1) * (0.6 + 0.4 * np.sin(2 * np.pi * 0.09 * t))
    aenv = np.interp(t, [0, 1.5, 5.2, 9, 14, 54.5, 57, 60], [0, 1, 1, 0.35, 0.08, 0.08, 0.5, 0.0])
    S["drone"].add(np.stack([air, air_r], axis=1) * aenv[:, None], 0, 0.3, 0, send=0.5)
    # A high, glassy halo over the prelude.
    S["pad"].add(pad([hz("D4"), hz("A4"), hz("D5"), hz("A5")], 5.6, attack=2.6, release=2.0, cutoff=3000, voices=3),
                 0.3, 0.75, 0, send=0.8)

    # ── Pads ────────────────────────────────────────────────────────────
    pad_level = {3: 0.42, 4: 0.5, 5: 0.6, 6: 0.66, 7: 0.8, 8: 0.84, 9: 0.66, 10: 0.72, 11: 0.86, 12: 0.88,
                 13: 0.95, 14: 0.98, 15: 0.8, 16: 0.86, 17: 0.98, 18: 1.06, 19: 1.15, 20: 0.7}
    pad_cut = {3: 900, 4: 1000, 5: 1250, 6: 1350, 7: 1700, 8: 1800, 9: 1500, 10: 1600, 11: 1500, 12: 1600,
               13: 2300, 14: 2400, 15: 1700, 16: 2000, 17: 2700, 18: 3100, 19: 3200, 20: 1500}
    for bar in range(3, 21):
        chord = [hz(n) for n in CHORDS[BARS[bar][0]]]
        dur = 3.0 if bar < 20 else 2.6
        S["pad"].add(pad(chord, dur, attack=0.75 if bar > 3 else 1.6, release=1.25 if bar < 20 else 3.0,
                         cutoff=pad_cut[bar] * 1.35, air=0.3), T(bar) - 0.12, pad_level[bar], 0, send=0.55)
    # Upper strings for lift.
    for bar, notes, g in [(13, ["F5", "A5", "C6"], 0.34), (14, ["E5", "G5", "C6"], 0.36), (17, ["F5", "Bb5", "D6"], 0.4),
                          (18, ["G5", "C6", "E6"], 0.46), (19, ["F#5", "A5", "D6", "F#6"], 0.5)]:
        S["pad"].add(pad([hz(n) for n in notes], 3.0, attack=0.9, release=1.4, cutoff=4200, voices=4, detune=0.004),
                     T(bar) - 0.1, g, 0, send=0.75)

    # ── Bass ────────────────────────────────────────────────────────────
    for bar in range(3, 21):
        f = hz(BARS[bar][1])
        while f < 34:
            f *= 2
        if 11 <= bar <= 18:
            # Driving eighths.
            for i in range(8):
                acc = 1.0 if i % 2 == 0 else 0.72
                S["bass"].add(bass(f * (2 if bar >= 15 and i % 4 == 3 else 1), 0.3, 0.008, grit=0.5),
                              T(bar, i * 0.5), 0.8 * acc, 0, send=0.06)
        else:
            S["bass"].add(bass(f, 2.85 if bar < 20 else 2.4, 0.12 if bar > 6 else 0.5, grit=0.25), T(bar),
                          0.62 if bar < 19 else 0.9, 0, send=0.1)

    # ── Melody ──────────────────────────────────────────────────────────
    def line(inst, bar, notes, gain, pan=0.0, send=0.4, **kw):
        for beat, dur, name in notes:
            S["lead"].add(inst(hz(name), dur * BEAT, **kw), T(bar, beat), gain, pan, send)

    def harp(f, d, **kw):
        return pluck(f, max(d, 2.4), bright=0.7, damp=0.75)

    # Bars 3–4: the first voice — a lone plucked string.
    line(harp, 3, [(2, 1, "A4"), (3, 1, "D5")], 0.5, -0.15, 0.6)
    line(harp, 4, [(0, 1.5, "F5"), (1.5, 0.5, "E5"), (2, 1, "D5"), (3, 1, "A4")], 0.5, -0.15, 0.6)
    # Bars 5–6: a breath joins it.
    m5 = [(0, 1.5, "F5"), (1.5, 0.5, "G5"), (2, 1, "A5"), (3, 1, "F5")]
    m6 = [(0, 1.5, "E5"), (1.5, 0.5, "F5"), (2, 1, "G5"), (3, 0.5, "E5"), (3.5, 0.5, "C5")]
    line(flute, 5, m5, 0.36, 0.2, 0.6)
    line(flute, 6, m6, 0.36, 0.2, 0.6)
    line(harp, 5, [(b, d, n[:-1] + str(int(n[-1]) - 1)) for b, d, n in m5], 0.3, -0.25, 0.5)
    line(harp, 6, [(b, d, n[:-1] + str(int(n[-1]) - 1)) for b, d, n in m6], 0.3, -0.25, 0.5)
    # Bars 7–8: empire — horns and strings carry the theme.
    m7 = [(0, 2, "D5"), (2, 1, "F5"), (3, 1, "A5")]
    m8 = [(0, 1.5, "A5"), (1.5, 0.5, "G5"), (2, 1, "F5"), (3, 1, "C5")]
    for bar, m in [(7, m7), (8, m8)]:
        line(horn, bar, [(b, d, n[:-1] + str(int(n[-1]) - 1)) for b, d, n in m], 0.42, -0.1, 0.5)
        for b, d, n in m:
            S["lead"].add(pad([hz(n)], d * BEAT, attack=0.1, release=0.35, cutoff=3000, voices=4, detune=0.004),
                          T(bar, b), 0.5, 0, 0.55)
    # Bars 9–10: scholars — bright strings of a santur, doubled by chimes.
    m9 = [(0, 1, "Bb5"), (1, 1, "A5"), (2, 1, "G5"), (3, 1, "D5")]
    m10 = [(0, 1.5, "F5"), (1.5, 0.5, "G5"), (2, 1, "A5"), (3, 1, "Bb5")]
    for bar, m in [(9, m9), (10, m10)]:
        line(lambda f, d: pluck(f, 1.6, bright=1.0, damp=1.3), bar, m, 0.42, 0.1, 0.5)
        for b, d, n in m:
            S["chimes"].add(bell(hz(n) * 2, 1.6), T(bar, b), 0.1, 0.3, 0.7)
    # Bars 11–12: the steppe — low brass.
    line(horn, 11, [(0, 3, "D3"), (3, 1, "F3")], 0.62, 0, 0.4, cutoff=800)
    line(horn, 12, [(0, 3, "E3"), (3, 1, "G3")], 0.62, 0, 0.4, cutoff=800)
    line(horn, 11, [(0, 3, "D4"), (3, 1, "F4")], 0.34, 0.1, 0.45, cutoff=1000)
    line(horn, 12, [(0, 3, "E4"), (3, 1, "G4")], 0.34, 0.1, 0.45, cutoff=1000)
    # Bars 13–14: open sea — the theme soars.
    m13 = [(0, 2, "A5"), (2, 1, "C6"), (3, 1, "A5")]
    m14 = [(0, 2, "G5"), (2, 1, "E5"), (3, 1, "G5")]
    for bar, m in [(13, m13), (14, m14)]:
        line(horn, bar, [(b, d, n[:-1] + str(int(n[-1]) - 1)) for b, d, n in m], 0.42, -0.1, 0.5)
        for b, d, n in m:
            S["lead"].add(pad([hz(n), hz(n) / 2], d * BEAT, attack=0.14, release=0.4, cutoff=3400, voices=4,
                              detune=0.004), T(bar, b), 0.56, 0, 0.6)
    # Bars 15–16: machines — clipped strings.
    m15 = [(0, 1, "Bb5"), (1, 1, "A5"), (2, 1, "Bb5"), (3, 1, "D6")]
    m16 = [(0, 2, "C#6"), (2, 1, "E6"), (3, 0.5, "C#6"), (3.5, 0.5, "E6")]
    for bar, m in [(15, m15), (16, m16)]:
        for b, d, n in m:
            S["lead"].add(pad([hz(n), hz(n) / 2], d * BEAT, attack=0.05, release=0.3, cutoff=3200, voices=4,
                              detune=0.004), T(bar, b), 0.5, 0, 0.5)
    # Bars 17–18: the century accelerates.
    m17 = [(0, 2, "D6"), (2, 1, "F6"), (3, 1, "D6")]
    m18 = [(0, 2, "E6"), (2, 1, "G6"), (3, 0.5, "E6"), (3.5, 0.5, "G6")]
    for bar, m in [(17, m17), (18, m18)]:
        line(horn, bar, [(b, d, n[:-1] + str(int(n[-1]) - 2)) for b, d, n in m], 0.46, -0.1, 0.5, cutoff=1300)
        for b, d, n in m:
            S["lead"].add(pad([hz(n), hz(n) / 2], d * BEAT, attack=0.08, release=0.4, cutoff=4200, voices=5,
                              detune=0.005), T(bar, b), 0.6, 0, 0.6)
    # Bars 19–20: arrival in D major, then the lone string again.
    S["lead"].add(pad([hz("A5"), hz("D6"), hz("A4")], 2.6, attack=0.05, release=2.2, cutoff=4200, voices=5),
                  T(19), 0.6, 0, 0.7)
    line(harp, 19, [(2, 1, "A5"), (3, 1, "F#5")], 0.42, -0.15, 0.7)
    for name, g, p in [("D5", 0.6, -0.1), ("A5", 0.36, 0.15), ("F#5", 0.3, 0.0), ("D4", 0.34, -0.2)]:
        S["lead"].add(pluck(hz(name), 3.4, bright=0.7, damp=0.6), T(20) + 0.1, g, p, 0.85)
    S["chimes"].add(bell(hz("D6"), 3.0, 0.7), T(20) + 0.1, 0.16, 0.2, 0.9)

    # ── The spark (6.0 s): one plucked note in the dark ─────────────────
    for name, g, p in [("D5", 0.7, 0.0), ("A5", 0.34, 0.2), ("D4", 0.38, -0.2)]:
        S["lead"].add(pluck(hz(name), 3.6, bright=0.75, damp=0.55), 6.0, g, p, 0.9)
    S["chimes"].add(bell(hz("D6"), 3.2, 0.7), 6.0, 0.22, 0.1, 0.9)
    S["chimes"].add(bell(hz("A6"), 2.6, 0.8), 6.0, 0.09, -0.2, 0.9)
    S["fx"].add(sweep(1.5, 500, 5200, "rise", 0.5), 4.5, 0.2, 0, 0.6)
    S["fx"].add(boom(44, 0.9), 6.0, 0.36, 0, 0.3)

    # ── Arpeggios ───────────────────────────────────────────────────────
    def arp(bar, names, inst, gain, pattern=None, step=0.25, pan_w=0.5, send=0.35):
        seq = pattern or list(range(len(names))) + list(range(len(names) - 2, 0, -1))
        i = 0
        b = 0.0
        while b < 4 - 1e-9:
            n = names[seq[i % len(seq)]]
            acc = 1.0 if i % 4 == 0 else 0.7
            S["arp"].add(inst(hz(n)), T(bar, b), gain * acc, pan_w * np.sin(i * 1.9), send)
            i += 1
            b += step
    santur = lambda f: pluck(f, 0.9, bright=1.0, damp=2.2, attack_noise=0.4)
    arp(9, ["G3", "D4", "G4", "Bb4", "D5"], santur, 0.3)
    arp(10, ["Bb3", "F4", "Bb4", "D5", "F5"], santur, 0.3)
    sp = lambda f: synth_pluck(f, 0.22, 2400)
    arp(15, ["G4", "Bb4", "D5", "G5"], sp, 1.5, pattern=[0, 1, 2, 3, 2, 1, 2, 3])
    arp(16, ["A4", "C#5", "E5", "A5"], sp, 1.65, pattern=[0, 1, 2, 3, 2, 1, 2, 3])
    sp2 = lambda f: synth_pluck(f, 0.2, 3600)
    arp(17, ["Bb4", "D5", "F5", "Bb5", "D6"], sp2, 1.5, pattern=[0, 2, 1, 3, 2, 4, 3, 1])
    arp(18, ["C5", "E5", "G5", "C6", "E6"], sp2, 1.7, pattern=[0, 2, 1, 3, 2, 4, 3, 1])
    arp(19, ["D5", "F#5", "A5", "D6", "F#6"], sp2, 1.1, pattern=[0, 2, 1, 3, 2, 4, 3, 1], send=0.6)
    # Thin the last arpeggio out so the ending can breathe.
    i0, i1 = int(T(19, 1.5) * SR), int(T(20) * SR)
    ramp = np.linspace(1, 0, i1 - i0) ** 1.5
    for arr in (S["arp"].dry, S["arp"].send):
        arr[i0:i1] *= ramp[:, None]
        arr[i1:] = 0

    # ── String ostinato ─────────────────────────────────────────────────
    def ost(bar, names, gain, cutoff=1500):
        for i, n in enumerate(names):
            S["ost"].add(stab(hz(n), 0.24, cutoff), T(bar, i * 0.5), 3.2 * gain * (1.0 if i % 2 == 0 else 0.78),
                         -0.35 + 0.1 * (i % 2), 0.3)
    ost(7, ["D3", "D3", "A3", "D3", "F3", "D3", "A3", "D3"], 0.5)
    ost(8, ["F3", "F3", "C4", "F3", "A3", "F3", "C4", "F3"], 0.5)
    ost(11, ["D2", "D2", "D3", "D2", "A2", "D2", "D3", "D2"], 0.7, 1100)
    ost(12, ["C2", "C2", "C3", "C2", "G2", "C2", "C3", "C2"], 0.7, 1100)
    ost(11, ["D3", "A3", "D4", "A3", "D3", "A3", "D4", "A3"], 0.42, 2600)
    ost(12, ["C3", "G3", "C4", "G3", "C3", "G3", "C4", "G3"], 0.42, 2600)
    S["pad"].add(pad([hz("D5"), hz("A5")], 3.0, attack=0.6, release=1.0, cutoff=4500, voices=4), T(11), 0.3, 0, 0.7)
    S["pad"].add(pad([hz("E5"), hz("G5")], 3.0, attack=0.6, release=1.0, cutoff=4500, voices=4), T(12), 0.3, 0, 0.7)
    ost(13, ["F3", "C4", "F4", "C4", "A3", "C4", "F4", "C4"], 0.46, 1900)
    ost(14, ["C3", "G3", "C4", "G3", "E3", "G3", "C4", "G3"], 0.46, 1900)

    # ── Drums ───────────────────────────────────────────────────────────
    D = S["drums"]
    # Bars 3–4: a heartbeat.
    for bar, beats in [(3, [0]), (4, [0, 2.5])]:
        for b in beats:
            D.add(taiko(54, 0.5, tone=0.4, noise=0.15), T(bar, b), 0.28, 0, 0.5)
    # Bars 5–6: frame drum.
    for bar in (5, 6):
        for b, g in [(0, 0.5), (1.5, 0.3), (2, 0.42), (3.5, 0.24)]:
            D.add(taiko(70, 0.3, tone=0.8, noise=0.3), T(bar, b), g, -0.1, 0.4)
    # Bars 7–8: taiko.
    D.add(taiko(46, 0.75, noise=0.8), T(7), 0.95, 0, 0.5)
    D.add(boom(40, 1.1), T(7), 0.5, 0, 0.3)
    for bar in (7, 8):
        for b, g in [(0, 0.62), (1.5, 0.4), (2, 0.55), (3, 0.42), (3.5, 0.5)]:
            D.add(taiko(58, 0.4, noise=0.5), T(bar, b), g, 0.1, 0.4)
        for b in (0.75, 2.75):
            D.add(taiko(92, 0.16, noise=0.4), T(bar, b), 0.22, -0.3, 0.3)
    # Bars 9–10: hand drums (a maqsum-like pattern in sixteenths).
    D.add(taiko(60, 0.5, noise=0.4), T(9), 0.5, 0, 0.5)
    for bar in (9, 10):
        for half in (0, 2):
            for s16, kind in [(0, "d"), (1, "t"), (3, "t"), (4, "d"), (6, "t")]:
                b = half + s16 * 0.25
                if kind == "d":
                    D.add(taiko(84, 0.2, tone=0.9, noise=0.3), T(bar, b), 0.4, -0.15, 0.3)
                else:
                    D.add(tek(560 + 60 * (s16 % 2)), T(bar, b), 0.25, 0.25, 0.3)
            D.add(tek(900, 0.03), T(bar, half + 1.75), 0.12, 0.4, 0.3)
    # Bars 11–12: the gallop.
    D.add(taiko(42, 0.9, noise=0.9), T(11), 1.0, 0, 0.5)
    D.add(boom(36, 1.3), T(11), 0.6, 0, 0.3)
    for bar in (11, 12):
        for beat in range(4):
            D.add(taiko(60, 0.3, noise=0.6), T(bar, beat), 0.7 if beat % 2 == 0 else 0.55, 0.0, 0.35)
            D.add(taiko(96, 0.13, noise=0.5), T(bar, beat + 0.5), 0.34, -0.3, 0.3)
            D.add(taiko(104, 0.12, noise=0.5), T(bar, beat + 0.75), 0.4, 0.3, 0.3)
        D.add(taiko(46, 0.6, noise=0.8), T(bar, 0), 0.5, 0, 0.45)
    # Bars 13–14: sea swells and rolling toms.
    D.add(taiko(44, 0.9, noise=0.8), T(13), 0.9, 0, 0.5)
    D.add(crash(1.5), T(13), 0.2, 0, 0.6)
    for bar in (13, 14):
        for b, g in [(0, 0.7), (2, 0.55)]:
            D.add(taiko(56, 0.5, noise=0.6), T(bar, b), g, 0, 0.4)
        for i in range(8):
            D.add(taiko(72 + 6 * i, 0.16, noise=0.45), T(bar, 3 + i * 0.125), 0.16 + 0.05 * i, -0.4 + 0.1 * i, 0.3)
        S["fx"].add(sweep(2.6, 300, 1600, "swell", 0.8), T(bar, 0.4), 0.22, -0.3 if bar == 13 else 0.3, 0.5)
    # Bars 15–16: the machine.
    D.add(anvil(520, 0.7), T(15), 0.55, 0, 0.5)
    D.add(boom(40, 1.0), T(15), 0.55, 0, 0.3)
    for bar in (15, 16):
        for beat in range(4):
            D.add(kick(50, 0.2), T(bar, beat), 0.8, 0, 0.12)
            if beat % 2 == 1:
                D.add(anvil(700, 0.3), T(bar, beat), 0.26, 0.25, 0.45)
            for s in range(4):
                D.add(tick(3800 + 500 * (s % 2)), T(bar, beat + s * 0.25), 0.12 if s else 0.07,
                      0.5 * (-1) ** s, 0.15)
            D.add(taiko(88, 0.12, noise=0.5), T(bar, beat + 0.5), 0.26, -0.2, 0.25)
    # Bars 17–18: electric.
    D.add(boom(38, 1.1), T(17), 0.6, 0, 0.3)
    for bar in (17, 18):
        for beat in range(4):
            D.add(kick(48, 0.22), T(bar, beat), 0.9, 0, 0.1)
            if beat % 2 == 1:
                D.add(clap(0.1), T(bar, beat), 0.34, 0, 0.4)
            for s in range(4):
                D.add(tick(5200), T(bar, beat + s * 0.25), 0.11 if s % 2 else 0.06, 0.4 * (-1) ** s, 0.12)
        if bar == 18:
            for i in range(12):
                D.add(taiko(60 + 5 * i, 0.16, noise=0.5), T(bar, 2.5 + i * 0.125), 0.2 + 0.05 * i, -0.5 + 0.09 * i, 0.3)
    # Bar 19: arrival.
    D.add(boom(34, 1.9), T(19), 1.0, 0, 0.35)
    D.add(taiko(40, 1.1, noise=1.0), T(19), 1.0, 0, 0.55)
    D.add(crash(2.3), T(19), 0.24, 0, 0.7)
    D.add(taiko(50, 0.7, noise=0.4), T(19, 2), 0.3, 0, 0.5)

    # ── Transitions ─────────────────────────────────────────────────────
    fx = S["fx"]
    fx.add(boom(42, 1.2), 3.55, 0.42, 0, 0.4)                       # title
    fx.add(sweep(1.1, 300, 2400, "rise"), 2.5, 0.12, 0, 0.5)
    for bar, g in [(5, 0.1), (7, 0.2), (9, 0.13), (11, 0.22), (13, 0.2), (17, 0.2)]:
        fx.add(sweep(1.2, 400, 5000, "rise"), T(bar) - 1.2, g, 0, 0.5)
        fx.add(sweep(1.0, 4000, 500, "fall"), T(bar), g * 0.6, 0, 0.5)
    # The leap from 1522 to 1760.
    fx.add(sweep(1.5, 250, 8000, "rise", 0.45), 40.7, 0.3, 0, 0.5)
    fx.add(sweep(1.4, 6000, 300, "fall"), T(15), 0.2, 0, 0.5)
    # The long riser into today.
    fx.add(sweep(3.0, 220, 9000, "rise", 0.5), 51.0, 0.42, 0, 0.5)
    fx.add(sweep(2.2, 7000, 250, "fall", 0.7), 54.0, 0.3, 0, 0.6)

    # ── Chimes on the lights ────────────────────────────────────────────
    cues = json.load(open(os.path.join(ROOT, "out", "cues.json")))
    scale = ["D5", "F5", "G5", "A5", "C6", "D6", "F6", "G6", "A6"]
    last = -1.0
    k = 0
    for c in cues["ignitions"]:
        if c["t"] < 6.3 or c["t"] > 41.5:
            continue
        if c["t"] - last < (0.16 if c["mag"] == 3 else 0.34):
            continue
        last = c["t"]
        bar = int(c["t"] // 3) + 1
        chord = CHORDS[BARS[bar][0]]
        tones = {n[:-1] for n in chord}
        pool = [n for n in scale if n[:-1] in tones] or scale
        name = pool[(k * 5 + 2) % len(pool)]
        k += 1
        g = 0.115 if c["mag"] == 3 else 0.06
        S["chimes"].add(bell(hz(name), 1.8, 1.0), c["t"], g, float(np.clip((c["lon"] - 50) / 110, -0.8, 0.8)), 0.8)
    # One billion people.
    for i, name in enumerate(["D6", "A6", "D7"]):
        S["chimes"].add(bell(hz(name), 2.0, 0.8), cues["billion"] + i * 0.07, 0.11, 0.3 * (i - 1), 0.8)
    # The web: a spray of high digital glints.
    web = ["D6", "F#6", "A6", "B6", "D7", "E7", "F#7", "A7"]
    for i in range(46):
        tt = 52.3 + (i / 46) ** 0.8 * 5.2 + rng.uniform(-0.03, 0.03)
        f = hz(web[int(rng.integers(0, len(web)))]) if tt > 54 else hz(["D6", "F6", "G6", "A6", "C7", "D7"][int(rng.integers(0, 6))])
        g = 0.17 * (1.0 if tt < 55.5 else max(0.0, 1 - (tt - 55.5) / 2.2))
        S["chimes"].add(synth_pluck(f, 0.12, 6000), tt, g, float(rng.uniform(-0.8, 0.8)), 0.6)

    # ── Story effects (added after the music is ducked) ─────────────────
    late = S["late"]
    # Telegraph: the first transatlantic cable, 1866.
    for i, (on, ln) in enumerate([(0.0, 0.05), (0.12, 0.05), (0.24, 0.15), (0.47, 0.05), (0.59, 0.15), (0.82, 0.05)]):
        tt = tarr(ln)
        beep = np.sin(2 * np.pi * 880 * tt) * 0.8 + np.sin(2 * np.pi * 1760 * tt) * 0.12
        late.add(fade(beep, 0.004, 0.006), 46.15 + on, 0.05, -0.5 + i * 0.2, 0.5)
    # Two wars: distant thunder under faltering lights.
    for t0, ln, g in [(49.15, 0.9, 0.42), (49.95, 1.0, 0.56)]:
        n = int(ln * SR)
        tt = np.arange(n) / SR
        rumble = lp(rng.standard_normal(n), 120, 3) * 3.0 + lp(rng.standard_normal(n), 60, 2) * 4.0
        rumble *= np.sin(np.pi * np.minimum(1, tt / ln)) ** 1.5 * (0.7 + 0.3 * np.sin(2 * np.pi * 7 * tt))
        late.add(rumble, t0, g, 0, 0.5)
        late.add(boom(33, 0.8), t0 + 0.12, g * 0.9, -0.3, 0.5)
        late.add(boom(29, 0.9), t0 + 0.42, g * 0.75, 0.3, 0.5)
    # Apollo 11: ascent, then a radio beep on arrival.
    late.add(sweep(1.15, 180, 3200, "rise", 0.6), 50.7, 0.26, 0.3, 0.5)
    tt = tarr(0.24)
    late.add(fade(np.sin(2 * np.pi * 2525 * tt), 0.004, 0.01), 51.78, 0.035, 0.45, 0.6)

    return stems


# Target loudness per bar (dB, K-weighted, relative): the film's dynamic arc.
ARC = [-30, -28, -23.5, -24, -21.5, -21, -17.5, -17.5, -19, -18.5, -16, -16, -15.5, -15, -16, -15.5,
       -14.5, -13.5, -13.5, -21.5]


def k_weight(x):
    """Rough K-weighting (ITU-R BS.1770): low cut plus a high shelf."""
    x = hp(x, 60, 2)
    return x + 0.58 * hp(x, 1500, 1)


def loud_db(x):
    return 10 * np.log10(np.mean(k_weight(x) ** 2) * 2 + 1e-12)


def mixdown(stems, report=False):
    gains = {"drone": 0.36, "pad": 0.42, "bass": 0.6, "lead": 0.62, "arp": 0.6, "ost": 0.5, "drums": 1.0,
             "chimes": 1.4, "fx": 0.6, "late": 1.0}
    ir = make_ir(3.1)
    music = np.zeros((N, 2))
    send = np.zeros((N, 2))
    for name, st in stems.items():
        if name == "late":
            continue
        music += st.dry * gains[name]
        send += st.send * gains[name]
    wet = np.stack([fftconvolve(send[:, ch], ir[:, ch])[:N] for ch in range(2)], axis=1)
    music = music + hp(wet, 140, 2) * 0.5

    # Ride the level bar by bar so the piece follows the intended arc.
    t = np.arange(N) / SR
    centres, ride = [], []
    for bar in range(1, 21):
        seg = music[int(T(bar) * SR) : int(T(bar + 1) * SR)]
        centres.append(T(bar) + 1.5)
        ride.append(ARC[bar - 1] - loud_db(seg))
    ride = np.array(ride)
    ride -= ride[12:19].mean()                       # keep the loud bars near unity
    ride = np.clip(ride, -14, 8)
    curve = np.interp(t, [0] + centres + [60], [ride[0]] + list(ride) + [ride[-1]])
    music *= (10 ** (curve / 20))[:, None]

    # The music falters with the lights, twice.
    def dip(a, b, depth):
        return depth * np.minimum(np.clip((t - a) / 0.2, 0, 1), np.clip((b - t) / 0.3, 0, 1))

    music *= (1 - dip(49.2, 49.75, 0.42) - dip(50.0, 50.55, 0.55))[:, None]

    late = stems["late"]
    late_wet = np.stack([fftconvolve(late.send[:, ch], ir[:, ch])[:N] for ch in range(2)], axis=1)
    late_gain = 10 ** (np.interp(49.5, centres, ride) / 20)
    mix = music + (late.dry + hp(late_wet, 140, 2) * 0.5) * late_gain

    mix = hp(mix, 26, 2)
    mix *= 0.6 / np.percentile(np.abs(mix), 99.95)
    board = Pedalboard([
        LowShelfFilter(cutoff_frequency_hz=62, gain_db=-4.5),
        HighShelfFilter(cutoff_frequency_hz=3200, gain_db=5.0),
        Compressor(threshold_db=-12, ratio=1.7, attack_ms=30, release_ms=300),
        Limiter(threshold_db=-1.5, release_ms=150),
    ])
    out = board(mix.T.astype(np.float32), SR).T.astype(np.float64)
    # Normalise to -1.5 dB true peak (measured 4x oversampled) so encoding never clips.
    true_peak = max(np.abs(resample_poly(out[:, ch], 4, 1)).max() for ch in range(2))
    out *= 10 ** (-1.5 / 20) / true_peak
    out *= (np.clip(t / 0.5, 0, 1) ** 2 * np.clip((60.0 - t) / 1.1, 0, 1) ** 1.6)[:, None]

    if report:
        print("ride (dB):", " ".join(f"{r:+.1f}" for r in ride))
        print("bar loudness after master:", " ".join(f"{loud_db(out[int(T(b) * SR):int(T(b + 1) * SR)]):.1f}" for b in range(1, 21)))
        edges = [20, 60, 250, 1000, 4000, 16000]
        print("band energy (dB) per 6 s   sub   bass  lowmid  mid   high")
        for a in range(0, 60, 6):
            seg = out[a * SR : (a + 6) * SR].mean(axis=1)
            spec = np.abs(np.fft.rfft(seg)) ** 2
            f = np.fft.rfftfreq(len(seg), 1 / SR)
            tot = spec.sum() + 1e-20
            print(f"  {a:2d}-{a + 6:2d}s             " + " ".join(
                f"{10 * np.log10(spec[(f >= lo) & (f < hi)].sum() / tot + 1e-12):6.1f}" for lo, hi in zip(edges, edges[1:])))
    return out


def main():
    stems = build()
    out = mixdown(stems, report=True)
    os.makedirs(os.path.join(ROOT, "out"), exist_ok=True)
    path = os.path.join(ROOT, "out", "score.wav")
    pcm = (np.clip(out, -1, 1) * (2 ** 23 - 1)).astype(np.int32)
    raw = np.zeros((N, 2, 3), dtype=np.uint8)
    raw[..., 0] = pcm & 0xFF
    raw[..., 1] = (pcm >> 8) & 0xFF
    raw[..., 2] = (pcm >> 16) & 0xFF
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(3)
        w.setframerate(SR)
        w.writeframes(raw.tobytes())
    print(f"wrote {os.path.normpath(path)}: peak {np.abs(out).max():.3f}")


if __name__ == "__main__":
    main()
