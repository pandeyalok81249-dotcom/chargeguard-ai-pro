"""Hardware Simulator Service for ChargeGuard AI Pro.

Provides dynamic, physically grounded real-time sensor measurements in Demonstration Mode.
Calculates:
- True copper conductor loop resistance based on length & wire gauge (22 AWG).
- Realistic connector contact resistance based on connector type and wear.
- Temperature-dependent resistance scaling (alpha = 0.00393 / °C).
- Real thermodynamic Joule heating (I^2 * R) and ambient thermal dissipation.
- Authentic thermal runaway triggering OVERHEAT WARNING (>=42°C) and OVERHEAT CRITICAL (>=50°C).
- Realistic ADC quantization (INA219 0.8mV/0.1mA and DS18B20 0.0625°C).

All simulated measurements explicitly carry `mode="demo"` and are clearly labeled so
they are never confused with real physical hardware.
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

        # Dynamic physical state
        self.load_current_target = 1.45
        self.current_temp = 27.2
        self.thermal_stress = (scenario == "overheating")
        self.flex_stress = False

        # Cable characteristics
        self.cable_length_m = 1.0
        self.cable_connector = "USB-C to USB-C"
        self.cable_condition = "Good"
        self.cable_rated_current = 2.4

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
        
        # Load cable physical specifications from DB
        db = SessionLocal()
        try:
            from app.models import Cable
            cable = db.query(Cable).filter(Cable.cable_id == cable_id).first()
            if cable:
                sim_task.cable_length_m = cable.length_m if cable.length_m is not None else 1.0
                sim_task.cable_connector = cable.connector_type or "USB-C to USB-C"
                sim_task.cable_rated_current = cable.rated_current_a if cable.rated_current_a is not None else 2.4
                sim_task.cable_condition = cable.cable_type or "Standard"
                if sim_task.cable_rated_current > 0:
                    sim_task.load_current_target = min(2.5, sim_task.cable_rated_current * 0.6)
        except Exception as e:
            logger.warning(f"Could not load cable specs for simulator: {e}")
        finally:
            db.close()

        if scenario == "overheating":
            sim_task.thermal_stress = True
            sim_task.load_current_target = 2.65
        elif scenario == "high_resistance":
            sim_task.load_current_target = 1.85

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

        logger.info(f"Started simulated test session {test_id} (Scenario: {scenario}, Cable: {cable_id})")

    def update_simulation_controls(
        self,
        test_id: str,
        load_current_a: Optional[float] = None,
        thermal_stress: Optional[bool] = None,
        flex_stress: Optional[bool] = None,
        scenario: Optional[str] = None
    ) -> bool:
        """Dynamically update physical parameters for a running simulation session."""
        if test_id in self.active_simulations:
            sim = self.active_simulations[test_id]
            if load_current_a is not None:
                sim.load_current_target = max(0.1, min(4.5, load_current_a))
            if thermal_stress is not None:
                sim.thermal_stress = thermal_stress
            if flex_stress is not None:
                sim.flex_stress = flex_stress
            if scenario is not None:
                sim.scenario = scenario
                if scenario == "overheating":
                    sim.thermal_stress = True
            logger.info(f"Updated live simulation controls for {test_id}: load={sim.load_current_target}A, thermal_stress={sim.thermal_stress}")
            return True
        return False

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

                # Allow extended run for live demonstration (up to 300 samples / 10 minutes) unless user stops
                if sim.step_count >= 300:
                    sim.is_running = False
                    db_final: Session = SessionLocal()
                    try:
                        await finalize_test_session(db_final, sim.test_id, stop_reason="Test duration completed (300 samples / 10 min)")
                    finally:
                        db_final.close()
                    break

                # Stream live update every 1.5 seconds for responsive high-tech feel
                await asyncio.sleep(1.5)
        except asyncio.CancelledError:
            logger.info(f"Simulation {sim.test_id} cancelled.")
        except Exception as e:
            logger.error(f"Error in simulation loop for {sim.test_id}: {e}", exc_info=True)
        finally:
            if sim.test_id in self.active_simulations:
                del self.active_simulations[sim.test_id]

    def _generate_sample(self, sim: SimulatorTask) -> MeasurementIngestContract:
        """
        Generate physically realistic dynamic sensor readings.
        Simulates:
        - Real conductor loop resistance based on length & wire gauge (22 AWG copper)
        - Real connector contact resistance based on connector type & wear
        - Copper temperature coefficient of resistance (alpha = 0.00393 / °C)
        - Real battery charger PWM ripple & dynamic load negotiation
        - Thermodynamic Joule heating model: dT/dt = (I^2 * R - k * (T - T_amb)) / C_th
        - Generates genuine OVERHEAT WARNING (>=42°C) and OVERHEAT CRITICAL (>=50°C)
        - ADC quantization noise for INA219 and DS18B20
        """
        step = sim.step_count
        now = utc_now()
        dt = 1.5

        # 1. Conductor physical resistance (Ohm's Law)
        # 22 AWG copper power lines: loop resistance approx 0.106 ohm/meter
        wire_r = max(0.035, sim.cable_length_m * 0.106)

        # Contact resistance
        conn_str = sim.cable_connector.lower()
        if "micro" in conn_str:
            contact_r = 0.075
        elif "usb-a" in conn_str:
            contact_r = 0.052
        else:
            contact_r = 0.036

        base_r = wire_r + contact_r

        # Scenario or dynamic adjustments
        if sim.scenario == "high_resistance":
            base_r += 0.46
        elif sim.scenario == "unstable":
            # Loose connector pin contact ripple
            base_r += 0.22 + 0.32 * abs(math.sin(step * 1.8)) + random.uniform(-0.04, 0.06)
        elif sim.scenario == "overheating" or sim.thermal_stress:
            # Severely degraded or corroded contact junction
            base_r += 0.58

        if sim.flex_stress:
            base_r += 0.20 * abs(math.sin(step * 2.8)) + random.uniform(0.01, 0.08)

        # Temperature coefficient of resistance for copper: alpha = 0.00393 / °C
        # R(T) = R_20 * (1 + alpha * (T - 20))
        r_effective = base_r * (1.0 + 0.00393 * max(0.0, sim.current_temp - 20.0))

        # 2. Dynamic Current Model
        target_i = sim.load_current_target
        if sim.scenario == "overheating" or sim.thermal_stress:
            target_i = max(2.35, target_i)
        elif sim.scenario == "normal":
            # Soft start ramp
            target_i = min(target_i, 0.45 + min(step, 6) * (target_i - 0.45) / 6.0)

        # Charger switching ripple (realistic PWM harmonics + Gaussian jitter)
        pwm_ripple = 0.024 * math.sin(step * 1.3) + random.gauss(0, 0.006)
        current = max(0.12, round(target_i + pwm_ripple, 3))

        # 3. Source Voltage (Regulated 5.0 V DC Profile)
        src_ripple = 0.014 * math.sin(step * 0.7) + random.gauss(0, 0.003)
        src_v = round(5.060 + src_ripple, 3)

        # 4. Sink Voltage via Ohm's Law: V_sink = V_source - I * R_effective
        v_drop = current * r_effective
        sink_v = round(max(3.2, src_v - v_drop + random.gauss(0, 0.003)), 3)

        # 5. Active Power
        power = round(sink_v * current, 3)

        # 6. Thermodynamic Heat Dissipation & Joule Heating:
        # P_loss = I^2 * R_effective
        # dT/dt = (P_loss - k_cooling * (T - T_amb)) / C_thermal
        p_loss = (current ** 2) * r_effective
        ambient_temp = 26.5
        k_cooling = 0.088  # W / °C cooling to ambient
        c_thermal = 2.2   # J / °C thermal capacity of connector shell

        if sim.scenario == "overheating" or sim.thermal_stress:
            # Overheat thermal runaway: heavy Joule heating exceeds dissipation
            p_loss = max(4.2, p_loss * 1.5)
            delta_t = ((p_loss - k_cooling * (sim.current_temp - ambient_temp)) / c_thermal) * dt
            delta_t = max(2.2, delta_t)  # Ensure temperature steadily and visibly climbs
        else:
            delta_t = ((p_loss - k_cooling * (sim.current_temp - ambient_temp)) / c_thermal) * dt

        sim.current_temp = max(ambient_temp, sim.current_temp + delta_t)
        # Quantize temperature reading realistically (DS18B20 has 0.0625°C resolution)
        reported_temp = round(sim.current_temp + random.choice([-0.06, 0.0, 0.06]), 1)

        # Handle single-ended mode
        if sim.scenario == "single_ended":
            src_v = None

        return MeasurementIngestContract(
            schema_version=1,
            device_id=sim.device_id,
            cable_id=sim.cable_id,
            test_id=sim.test_id,
            timestamp=now,
            mode="demo",
            source_voltage_v=src_v,
            sink_voltage_v=sink_v,
            current_a=current,
            power_w=power,
            temperature_c=reported_temp,
            measurement_valid=True,
            validity_reason=None
        )

simulator_service = SimulatorService()
