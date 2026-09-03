"""Выбор устройства (MPS / CUDA / CPU) и диагностика окружения."""

from __future__ import annotations

import platform
import sys

import torch


def pick_device(preferred: str) -> torch.device:
    """Вернуть torch.device по флагу --device (auto | mps | cuda | cpu)."""
    if preferred == "mps":
        if not (torch.backends.mps.is_available() and torch.backends.mps.is_built()):
            raise RuntimeError(
                "MPS недоступен: нужны macOS >= 12.3 и arm64-сборка torch >= 1.12. "
                "Проверьте: python -m bass2tabs --check"
            )
        return torch.device("mps")
    if preferred in ("cuda", "auto") and torch.cuda.is_available():
        return torch.device("cuda")
    if preferred == "auto" and torch.backends.mps.is_available() \
            and torch.backends.mps.is_built():
        return torch.device("mps")
    return torch.device("cpu")


def describe(device: torch.device) -> str:
    """Короткая сводка об окружении для первого блока вывода."""
    lines = [f"torch {torch.__version__} · python {sys.version.split()[0]}"]
    lines.append(f"{platform.system()} {platform.release()} · {platform.machine()}")
    lines.append(f"устройство: {device.type}")
    if device.type == "mps" and hasattr(torch.mps, "current_allocated_memory"):
        allocated = torch.mps.current_allocated_memory() / 1024 ** 2
        lines.append(f"mps: на старте выделено {allocated:.1f} MiB")
    return "\n".join(lines)


def check() -> int:
    """Диагностика окружения: версии, доступность MPS, тестовый matmul."""
    print("bass2tabs · проверка окружения")
    print(f"  torch            {torch.__version__}")
    try:
        from importlib.metadata import version as _pkg_version
        print(f"  torchcrepe       {_pkg_version('torchcrepe')}")
    except Exception:
        print('  torchcrepe       не установлен: pip install "torchcrepe>=0.0.22"')
    print(f"  python           {sys.version.split()[0]}")

    mps_ok = torch.backends.mps.is_available() and torch.backends.mps.is_built()
    print(f"  mps доступен     {'да' if mps_ok else 'нет'}")
    print(f"  cuda доступен    {'да' if torch.cuda.is_available() else 'нет'}")

    if mps_ok:
        a = torch.randn(512, 512, device="mps")
        b = torch.randn(512, 512, device="mps")
        c = (a @ b).sum()
        print(f"  mps matmul       ok ({c.item():.1f})")
    return 0
