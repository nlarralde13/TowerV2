import type { PlayerState, TorchState } from "../types";

export interface TorchTickResult {
  torch: TorchState;
  burned: number;
  extinguished: boolean;
}

export function consumeTorchFuel(torch: TorchState): TorchTickResult {
  const burned = Math.max(0, torch.fuelDrainPerTurn);
  const fuelCurrent = Math.max(0, torch.fuelCurrent - burned);
  return {
    torch: {
      ...torch,
      fuelCurrent,
    },
    burned,
    extinguished: fuelCurrent <= 0,
  };
}

export function restoreTorchFuel(torch: TorchState, amount: number): TorchState {
  if (amount <= 0) {
    return torch;
  }
  return {
    ...torch,
    fuelCurrent: Math.min(torch.fuelMax, torch.fuelCurrent + amount),
  };
}

export function getTorchRevealRadius(torch: TorchState): number {
  if (torch.fuelMax <= 0) {
    return torch.revealRadiusLow;
  }
  const ratio = torch.fuelCurrent / torch.fuelMax;
  if (ratio >= torch.highFuelThreshold) {
    return torch.revealRadiusHigh;
  }
  if (ratio >= torch.lowFuelThreshold) {
    return torch.revealRadiusMedium;
  }
  return torch.revealRadiusLow;
}

export function withUpdatedTorch(player: PlayerState, torch: TorchState): PlayerState {
  return {
    ...player,
    torch,
  };
}
