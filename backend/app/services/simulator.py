"""Hardware Simulator Service for ChargeGuard AI Pro.

Provides deterministic, reproducible scenarios in Demonstration Mode without
physical ESP32 hardware. All simulated measurements explicitly carry `mode="demo"`
and are clearly labeled so they are never confused with real hardware.
"""

import asyncio
import math
import random
from datetime import datetime
from typing import Dict, Optional
from sqlalchemy.orm import Session
from app.core.datetime_utils import utc_now

from app.db.database import SessionLocal
from app.schemas import MeasurementIngestContract
from app.services.test_runner import process_incoming_measurement, finalize_test_session
from app.core.logging import logger

class SimulatorTask:
    def __init__(self, test_id: str, device_id: str, cable_id: str, scenario: str):
        self.test_id = test_id
        self.device_id = device_id
        self.cable_id = cable_id
        self.scenario = scenario
        self.is_running = True
        self.step_count = 0
        self.task: Optional[asyncio.Task] = None

class SimulatorService:
    def __init__(self):
        self.active_simulations: Dict[str, SimulatorTask] = {}
        self.loop: Optional[asyncio.AbstractEventLoop] = None

    def start_simulation(
        self,
        test_id: str,
        device_id: str,
        cable_id: str,
        scenario: str = "normal"
    ):
        """Start a background simulation task for a demo test session."""
        if test_id in self.active_simulations:
            logger.warning(f"Simulation for test {test_id} already active")
            return

        sim_task = SimulatorTask(test_id, device_id, cable_id, scenario)
        self.active_simulations[test_id] = sim_task
        
        target_loop = None
        try:
            target_loop = asyncio.get_running_loop()
        except RuntimeError:
            target_loop = self.loop

        if target_loop and target_loop.is_running():
            try:
                sim_task.task = target_loop.create_task(self._run_simulation_loop(sim_task))
            except RuntimeError:
                # If running from a worker thread
                asyncio.run_coroutine_threadsafe(self._run_simulation_loop(sim_task), target_loop)
        else:
            sim_task.task = None

        logger.info(f"Started simulated test session {test_id} (Scenario: {scenario})")

    def stop_simulation(self, test_id: str):
        """Stop an active simulation."""
        if test_id in self.active_simulations:
            sim_task = self.active_simulations[test_id]
            sim_task.is_running = False
            if sim_task.task:
                sim_task.task.cancel()
            del self.active_simulations[test_id]
            logger.info(f"Stopped simulation task for test {test_id}")

    async def _run_simulation_loop(self, sim: SimulatorTask):
        """Async loop generating sensor frames and feeding test_runner."""
        try:
            while sim.is_running:
                sim.step_count += 1
                sample = self._generate_sample(sim)

                # Open a dedicated short-lived DB session for each sample
                db: Session = SessionLocal()
                try:
                    measurement = await process_incoming_measurement(db, sample)
                    
                    # Check if test runner stopped the session (e.g., safety stop)
                    from app.models import TestSession
                    s = db.query(TestSession).filter(TestSession.test_id == sim.test_id).first()
                    if s and s.status in ("stopped", "completed", "failed"):
                        sim.is_running = False
                        await finalize_test_session(db, sim.test_id, stop_reason=s.diagnostic_summary)
                        break
                finally:
                    db.close()

                # Automatically complete after 20 samples (~20 seconds) if not stopped
                if sim.step_count >= 20:
                    sim.is_running = False
                    db_final: Session = SessionLocal()
                    try:
                        await finalize_test_session(db_final, sim.test_id, stop_reason="Test duration completed (20 samples)")
                    finally:
                        db_final.close()
                    break

                await asyncio.sleep(1.0)
        except asyncio.CancelledError:
            logger.info(f"Simulation {sim.test_id} cancelled.")
        except Exception as e:
            logger.error(f"Error in simulation loop for {sim.test_id}: {e}", exc_info=True)
        finally:
            if sim.test_id in self.active_simulations:
                del self.active_simulations[sim.test_id]

    def _generate_sample(self, sim: SimulatorTask) -> MeasurementIngestContract:
        """Generate deterministic and reproducible readings according to scenario."""
        step = sim.step_count
        now = utc_now()

        # Seed slight deterministic variation based on step count
        noise_v = 0.005 * math.sin(step * 0.8)
        noise_i = 0.008 * math.cos(step * 0.7)

        if sim.scenario == "normal":
            # Healthy USB-C cable: 5.0V source, 4.88V sink, 0.95A, ~28°C
            # Voltage drop = 0.12V -> Resistance = ~0.126 ohm (PASS)
            return MeasurementIngestContract(
                schema_version=1,
                device_id=sim.device_id,
                cable_id=sim.cable_id,
                test_id=sim.test_id,
                timestamp=now,
                mode="demo",
                source_voltage_v=round(5.00 + noise_v * 0.5, 3),
                sink_voltage_v=round(4.88 + noise_v, 3),
                current_a=round(0.95 + noise_i, 3),
                power_w=round(4.88 * 0.95, 3),
                temperature_c=round(27.5 + (step * 0.1), 1),
                measurement_valid=True,
                validity_reason=None
            )

        elif sim.scenario == "high_resistance":
            # Degraded / Thin Cable: High drop (~0.65V), high resistance (~0.68 ohm) (WARN)
            return MeasurementIngestContract(
                schema_version=1,
                device_id=sim.device_id,
                cable_id=sim.cable_id,
                test_id=sim.test_id,
                timestamp=now,
                mode="demo",
                source_voltage_v=round(5.00 + noise_v * 0.5, 3),
                sink_voltage_v=round(4.35 + noise_v, 3),
                current_a=round(0.95 + noise_i, 3),
                power_w=round(4.35 * 0.95, 3),
                temperature_c=round(31.0 + (step * 0.25), 1),
                measurement_valid=True,
                validity_reason=None
            )

        elif sim.scenario == "overheating":
            # Dangerous thermal runaway: temperature climbs rapidly to > 50°C (CRITICAL STOP)
            temp = 32.0 + (step * 2.8)
            return MeasurementIngestContract(
                schema_version=1,
                device_id=sim.device_id,
                cable_id=sim.cable_id,
                test_id=sim.test_id,
                timestamp=now,
                mode="demo",
                source_voltage_v=5.00,
                sink_voltage_v=round(4.40 - (step * 0.02), 3),
                current_a=round(1.85 + (step * 0.01), 3),
                power_w=round(4.40 * 1.85, 3),
                temperature_c=round(temp, 1),
                measurement_valid=True,
                validity_reason=None
            )

        elif sim.scenario == "unstable":
            # Intermittent contact / damaged connector: erratic voltage swings (> 0.15V jitter)
            jitter = 0.28 * math.sin(step * 2.5) + (random.uniform(-0.1, 0.1))
            sink_v = max(3.8, min(4.95, 4.60 + jitter))
            return MeasurementIngestContract(
                schema_version=1,
                device_id=sim.device_id,
                cable_id=sim.cable_id,
                test_id=sim.test_id,
                timestamp=now,
                mode="demo",
                source_voltage_v=5.00,
                sink_voltage_v=round(sink_v, 3),
                current_a=round(max(0.2, 0.90 + (jitter * 0.4)), 3),
                power_w=round(sink_v * 0.90, 3),
                temperature_c=round(29.0 + (step * 0.15), 1),
                measurement_valid=True,
                validity_reason=None
            )

        elif sim.scenario == "single_ended":
            # Single-ended measurement: Source voltage is None!
            # Must strictly NOT calculate drop or resistance.
            return MeasurementIngestContract(
                schema_version=1,
                device_id=sim.device_id,
                cable_id=sim.cable_id,
                test_id=sim.test_id,
                timestamp=now,
                mode="demo",
                source_voltage_v=None,  # Explicitly missing
                sink_voltage_v=round(4.91 + noise_v, 3),
                current_a=round(0.85 + noise_i, 3),
                power_w=round(4.91 * 0.85, 3),
                temperature_c=round(28.0 + (step * 0.1), 1),
                measurement_valid=True,
                validity_reason=None
            )

        else:
            # Fallback to normal
            return MeasurementIngestContract(
                schema_version=1,
                device_id=sim.device_id,
                cable_id=sim.cable_id,
                test_id=sim.test_id,
                timestamp=now,
                mode="demo",
                source_voltage_v=5.00,
                sink_voltage_v=4.88,
                current_a=0.95,
                power_w=4.636,
                temperature_c=28.0,
                measurement_valid=True
            )

simulator_service = SimulatorService()
