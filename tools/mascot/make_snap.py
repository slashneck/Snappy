"""Synthesizes Snappy's save sound: a two-stage shutter 'ka-chik' plus a short rising chime (stdlib only).
Usage: python make_snap.py <out.wav>
"""
import math
import random
import struct
import sys
import wave

RATE = 44100
random.seed(7)
n = int(RATE * 0.46)
samples = [0.0] * n


def add(start, duration, fn):
    first = int(start * RATE)
    for i in range(int(duration * RATE)):
        if first + i < n:
            samples[first + i] += fn(i / RATE)


_lowpass = [0.0]


def click(amp, tau, thump):
    def f(t):
        _lowpass[0] = _lowpass[0] * 0.55 + random.uniform(-1, 1) * 0.45
        return amp * math.exp(-t / tau) * _lowpass[0] + thump * math.exp(-t / 0.018) * math.sin(2 * math.pi * 170 * t)
    return f


def tone(freq, amp, decay):
    return lambda t: amp * min(1, t / 0.006) * math.exp(-t / decay) * (
        math.sin(2 * math.pi * freq * t) + 0.18 * math.sin(4 * math.pi * freq * t))


add(0.000, 0.05, click(0.9, 0.0045, 0.35))   # shutter opens
add(0.058, 0.04, click(0.55, 0.0035, 0.18))  # shutter closes
add(0.110, 0.16, tone(1568.0, 0.26, 0.07))   # G6
add(0.185, 0.27, tone(2093.0, 0.30, 0.11))   # C7

gain = 0.7 / max(abs(x) for x in samples)
fade = int(0.01 * RATE)
for i in range(fade):
    samples[-1 - i] *= i / fade

with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(RATE)
    w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, x * gain)) * 32767)) for x in samples))
print(f"{sys.argv[1]}: {n / RATE:.2f}s")
