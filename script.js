const vehicles = {
  mobil: { name: "Mobil pickup", ratios: [3.58, 2, 1.35, 1, 0.8], final: 4.1, radius: 0.31, idle: 800, red: 6500, lowUp: 3000, highUp: 5500, lowDown: 1500, highDown: 3000, pull: [10, 7.5, 5, 3.4, 2.6], drag: 0.02 },
  motor: { name: "Motor sport", ratios: [3, 2, 1.5, 1.25, 1], final: 4.5, radius: 0.28, idle: 1400, red: 10000, lowUp: 6500, highUp: 9000, lowDown: 3000, highDown: 5500, pull: [12, 9, 7, 5.5, 4.5], drag: 0.03 }
};

let vehicleKey = "mobil";
let mode = "manual";
let running = false;
let speed = 120;
let rpm = 4200;
let throttle = 50;
let gear = 3;
let timer = null;
let shiftDelay = 0;

const $ = id => document.getElementById(id);
const speedInput = $("speedInput");
const rpmInput = $("rpmInput");
const throttleInput = $("throttleInput");
const formatNumber = value => Math.round(value).toLocaleString("id-ID");

function rpmAtSpeed(vehicle, velocity, selectedGear) {
  const circumference = 2 * Math.PI * vehicle.radius;
  const wheelRpm = (velocity / 3.6 / circumference) * 60;
  return Math.max(wheelRpm * vehicle.ratios[selectedGear - 1] * vehicle.final, vehicle.idle);
}

function guessGear(vehicle, velocity, engineRpm) {
  if (velocity <= 0) return 1;
  const circumference = 2 * Math.PI * vehicle.radius;
  const totalRatio = engineRpm * circumference * 3.6 / (60 * velocity);
  const gearRatio = totalRatio / vehicle.final;
  let nearest = 0;
  vehicle.ratios.forEach((ratio, index) => {
    if (Math.abs(ratio - gearRatio) < Math.abs(vehicle.ratios[nearest] - gearRatio)) nearest = index;
  });
  return nearest + 1;
}

function updateDisplay() {
  const vehicle = vehicles[vehicleKey];
  $("gearValue").textContent = gear;
  $("rpmValue").textContent = formatNumber(rpm);
  $("speedValue").textContent = Math.round(speed);
  $("dialRpm").textContent = formatNumber(rpm);
  $("gasStat").textContent = `${Math.round(throttle)}%`;
  $("speedOutput").value = Math.round(speed);
  $("rpmOutput").value = formatNumber(rpm);
  $("throttleOutput").value = Math.round(throttle);

  const percentage = Math.min(100, rpm / vehicle.red * 100);
  const color = rpm >= vehicle.red * 0.97 ? "#ff3b54" : rpm >= vehicle.red * 0.82 ? "#ffcc29" : "#25c9df";
  $("rpmFill").style.width = `${percentage}%`;
  $("rpmFill").style.background = color;
  $("zoneFill").style.width = `${percentage}%`;
  $("zoneFill").style.background = color;

  const zone = rpm >= vehicle.red * 0.97 ? "REDLINE" : rpm >= vehicle.red * 0.82 ? "RPM TINGGI" : "NORMAL";
  $("rpmZone").textContent = zone;
  $("rpmZone").style.color = color;
  $("heat").classList.toggle("hot", rpm >= vehicle.red * 0.82);
  $("smoke").classList.toggle("visible", rpm >= vehicle.red * 0.94);
  $("engineStatus").textContent = rpm >= vehicle.red * 0.97 ? "PERINGATAN: RPM REDLINE" : rpm >= vehicle.red * 0.82 ? "MESIN PANAS — KURANGI GAS" : "MESIN NORMAL";
  $("engineStatus").style.color = rpm >= vehicle.red * 0.82 ? color : "";
}

function addLog(message) {
  const log = $("logList");
  const item = document.createElement("span");
  item.textContent = `${new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · ${message}`;
  log.prepend(item);
  while (log.children.length > 6) log.lastElementChild.remove();
}

function manualAdvice(vehicle, velocity, engineRpm) {
  const estimatedGear = guessGear(vehicle, velocity, engineRpm);
  if (engineRpm >= vehicle.red * 0.97) {
    return estimatedGear < vehicle.ratios.length
      ? ["NAIK GIGI", "RPM mendekati redline. Pindah ke gigi lebih tinggi dan kurangi gas."]
      : ["TAHAN", "Sudah di gigi tertinggi. Kurangi gas agar mesin tetap aman."];
  }
  if (engineRpm >= vehicle.lowUp && estimatedGear < vehicle.ratios.length) return ["NAIK GIGI", "RPM sudah tinggi. Pertimbangkan pindah ke gigi selanjutnya."];
  if (engineRpm <= vehicle.idle * 1.3 && estimatedGear > 1) return ["TURUN GIGI", "RPM rendah; turun gigi dapat membantu menjaga tenaga mesin."];
  if (engineRpm <= vehicle.lowDown && estimatedGear > 1) return ["TURUN GIGI", "Tenaga mesin mulai rendah untuk kondisi ini."];
  return ["TAHAN", "RPM masih berada di rentang nyaman."];
}

function analyze() {
  const vehicle = vehicles[vehicleKey];
  if (mode === "manual") {
    gear = guessGear(vehicle, Math.max(speed, 1), rpm);
    const [action, reason] = manualAdvice(vehicle, speed, rpm);
    $("advice").innerHTML = `<strong>${action}</strong><span>${reason}</span>`;
    $("shiftStat").textContent = action === "TAHAN" ? "—" : action;
    addLog(`${vehicle.name}: ${action} — ${reason}`);
    updateDisplay();
  } else {
    autoDecision(true);
  }
}

function autoDecision(logNoShift = false) {
  const vehicle = vehicles[vehicleKey];
  if (shiftDelay > 0) {
    shiftDelay -= 1;
    return;
  }
  const gasRatio = throttle / 100;
  const upThreshold = vehicle.lowUp + gasRatio * (vehicle.highUp - vehicle.lowUp);
  const downThreshold = vehicle.lowDown + gasRatio * (vehicle.highDown - vehicle.lowDown);
  let action = "—";

  if (rpm >= upThreshold && gear < vehicle.ratios.length) {
    gear += 1;
    action = "NAIK";
  } else if (throttle >= 85 && gear > 1 && rpm < vehicle.highUp * 0.75) {
    const downshiftRpm = rpmAtSpeed(vehicle, speed, gear - 1);
    if (downshiftRpm < vehicle.red * 0.9) {
      gear -= 1;
      action = "KICKDOWN";
    }
  } else if (rpm <= downThreshold && gear > 1) {
    const downshiftRpm = rpmAtSpeed(vehicle, speed, gear - 1);
    if (downshiftRpm < vehicle.red * 0.9) {
      gear -= 1;
      action = "TURUN";
    }
  }

  if (action !== "—") {
    rpm = rpmAtSpeed(vehicle, speed, gear);
    shiftDelay = 3;
    addLog(`${action}: masuk gigi ${gear}.`);
  } else if (logNoShift) {
    addLog("Tidak perlu pindah gigi saat ini.");
  }
  $("shiftStat").textContent = action;
  updateDisplay();
}

function startAutomatic() {
  if (running) stopAutomatic();
  running = true;
  const vehicle = vehicles[vehicleKey];
  speed = 5;
  gear = 1;
  throttle = 40;
  rpm = rpmAtSpeed(vehicle, speed, gear);
  shiftDelay = 0;
  speedInput.value = Math.round(speed);
  throttleInput.value = throttle;
  $("vehicleSprite").classList.add("moving");
  $("track").classList.add("moving");
  $("launchBtn").textContent = "■ HENTIKAN SIMULASI";
  addLog(`Simulasi ${vehicle.name} dimulai.`);

  const throttleSequence = [50, 70, 30, 100, 0, 50];
  let sequenceIndex = 0;
  let ticks = 0;
  timer = setInterval(() => {
    const currentVehicle = vehicles[vehicleKey];
    throttle = throttleSequence[sequenceIndex];
    const force = throttle / 100 * currentVehicle.pull[gear - 1];
    const resistance = currentVehicle.drag * speed + (throttle === 0 ? 0.4 : 0);
    speed = Math.max(0, speed + force - resistance);
    if (throttle > 0) speed = Math.max(speed, 3);
    rpm = rpmAtSpeed(currentVehicle, speed, gear);
    ticks += 1;
    if (ticks % 7 === 0) sequenceIndex = (sequenceIndex + 1) % throttleSequence.length;
    speedInput.value = Math.min(Number(speedInput.max), Math.round(speed));
    throttleInput.value = throttle;
    autoDecision();
    updateDisplay();
  }, 350);
}

function stopAutomatic() {
  if (!running) return;
  running = false;
  clearInterval(timer);
  timer = null;
  $("vehicleSprite").classList.remove("moving");
  $("track").classList.remove("moving");
  $("launchBtn").textContent = "🏁 MULAI SIMULASI";
  addLog("Simulasi dihentikan.");
}

[speedInput, rpmInput, throttleInput].forEach(input => {
  input.addEventListener("input", () => {
    speed = Number(speedInput.value);
    rpm = Number(rpmInput.value);
    throttle = Number(throttleInput.value);
    if (!running) gear = guessGear(vehicles[vehicleKey], Math.max(speed, 1), rpm);
    updateDisplay();
  });
});

$("analyzeBtn").addEventListener("click", analyze);

document.querySelectorAll(".tab").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(tab => tab.classList.toggle("active", tab === button));
    mode = button.dataset.mode;
    document.querySelector(".manual-only").hidden = mode !== "manual";
    stopAutomatic();
  });
});

document.querySelectorAll(".vehicle").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".vehicle").forEach(item => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    vehicleKey = button.dataset.vehicle;
    const vehicle = vehicles[vehicleKey];
    rpmInput.max = vehicle.red;
    rpmInput.min = vehicle.idle;
    rpmInput.value = vehicleKey === "motor" ? 6500 : 4200;
    speedInput.value = vehicleKey === "motor" ? 100 : 120;
    speed = Number(speedInput.value);
    rpm = Number(rpmInput.value);
    gear = guessGear(vehicle, speed, rpm);
    updateDisplay();
    addLog(`${vehicle.name} dipilih.`);
  });
});

$("launchBtn").addEventListener("click", () => {
  if (mode !== "automatic") document.querySelector('[data-mode="automatic"]').click();
  if (running) stopAutomatic();
  else startAutomatic();
});

updateDisplay();
