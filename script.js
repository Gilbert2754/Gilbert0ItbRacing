const vehicles = {
  mobil: {
    name: "Mobil",
    ratios: [3.58, 2.00, 1.35, 1.00, 0.80],
    final: 4.10,
    radius: 0.31,
    idle: 800,
    red: 6500,
    lowUp: 3000,
    highUp: 5500,
    lowDown: 1500,
    highDown: 3000,
    pull: [10, 7.5, 5, 3.4, 2.6],
    drag: 0.02
  },
  motor: {
    name: "Motor",
    ratios: [3.00, 2.00, 1.50, 1.25, 1.00],
    final: 4.50,
    radius: 0.28,
    idle: 1400,
    red: 10000,
    lowUp: 6500,
    highUp: 9000,
    lowDown: 3000,
    highDown: 5500,
    pull: [12, 9, 7, 5.5, 4.5],
    drag: 0.03
  }
};

let vehicleKey = "mobil";
let mode = "manual";
let running = false;
let speed = 120;
let rpm = 4200;
let throttle = 50;
let gear = 3;
let timer = null;
let delay = 0;

const $ = id => document.getElementById(id);

const elements = {
  speedInput: $("speedInput"),
  rpmInput: $("rpmInput"),
  throttleInput: $("throttleInput"),
  speedOutput: $("speedOutput"),
  rpmOutput: $("rpmOutput"),
  throttleOutput: $("throttleOutput")
};

function rpmAtSpeed(vehicle, speed, gear) {
  const circumference = 2 * Math.PI * vehicle.radius;
  const wheelRPM = (speed / 3.6 / circumference) * 60;
  return Math.max(wheelRPM * vehicle.ratios[gear - 1] * vehicle.final, vehicle.idle);
}

function guessGear(vehicle, speed, rpm) {
  if (speed <= 0) return 1;
  const circumference = 2 * Math.PI * vehicle.radius;
  const totalRatio = rpm * circumference * 3.6 / (60 * speed);
  const gearRatio = totalRatio / vehicle.final;
  let nearest = 0;
  let difference = Infinity;

  vehicle.ratios.forEach((ratio, index) => {
    const candidate = Math.abs(ratio - gearRatio);
    if (candidate < difference) {
      difference = candidate;
      nearest = index;
    }
  });

  return nearest + 1;
}

function manualAdvice(vehicle, speed, rpm) {
  const gearGuess = guessGear(vehicle, speed, rpm);
  const topGear = vehicle.ratios.length;

  if (rpm >= vehicle.red * 0.97) {
    return gearGuess < topGear
      ? ["NAIK GIGI", "RPM hampir redline. Segera pindah ke gigi lebih tinggi."]
      : ["TAHAN", "Sudah gigi tertinggi. Kurangi gas agar mesin aman."];
  }

  if (rpm >= vehicle.lowUp && gearGuess < topGear) {
    return ["NAIK GIGI", `RPM tinggi untuk kondisi ini. Gigi baru: ${gearGuess + 1}.`];
  }

  if (rpm <= vehicle.idle * 1.3 && gearGuess > 1) {
    return ["TURUN GIGI", "Mesin lugging atau tenaga mulai tersendat."];
  }

  if (rpm <= vehicle.lowDown && gearGuess > 1) {
    return ["TURUN GIGI", "Tenaga mesin mulai kurang pada rentang kecepatan ini."];
  }

  return ["TAHAN", "RPM masih berada di zona aman dan nyaman."];
}

function updateInputs() {
  speed = Number(elements.speedInput.value);
  rpm = Number(elements.rpmInput.value);
  throttle = Number(elements.throttleInput.value);

  elements.speedOutput.value = speed;
  elements.rpmOutput.value = rpm;
  elements.throttleOutput.value = throttle;

  updateDisplay();
}

function updateDisplay() {
  const vehicle = vehicles[vehicleKey];
  gear = guessGear(vehicle, Math.max(speed, 1), rpm);

  $("gearValue").textContent = gear;
  $("rpmValue").textContent = Math.round(rpm).toLocaleString("id-ID");
  $("speedValue").textContent = Math.round(speed);
  $("dialRpm").textContent = Math.round(rpm).toLocaleString("id-ID");
  $("gasStat").textContent = `${throttle}%`;
  $("speedOutput").value = speed;
  $("rpmOutput").value = rpm;
  $("throttleOutput").value = throttle;

  const rpmPercent = Math.min(rpm / vehicle.red * 100, 100);
  $("rpmFill").style.width = `${rpmPercent}%`;
  $("zoneFill").style.width = `${rpmPercent}%`;

  let zone = "NORMAL";
  let zoneColor = "#25c9df";

  if (rpm > vehicle.red * 0.97) {
    zone = "OVER REDLINE";
    zoneColor = "#ff3b54";
  } else if (rpm > vehicle.red * 0.82) {
    zone = "HIGH RPM";
    zoneColor = "#ffcc29";
  }

  $("rpmZone").textContent = zone;
  $("rpmZone").style.color = zoneColor;

  $("heat").classList.toggle("hot", rpm > vehicle.red * 0.82);
  $("smoke").classList.toggle("visible", rpm > vehicle.red * 0.92);
  $("engineStatus").textContent = rpm > vehicle.red * 0.97 ? "ENGINE OVERHEAT" : "ENGINE NORMAL";
}

function analyze() {
  const vehicle = vehicles[vehicleKey];

  if (mode === "manual") {
    const [action, reason] = manualAdvice(vehicle, speed, rpm);
    const advice = $("advice");
    advice.innerHTML = `<strong>${action}</strong><span>${reason}</span>`;
    $("shiftStat").textContent = action === "TAHAN" ? "—" : action;
    addLog(`${vehicle.name}: ${action} — ${reason}`);
  } else {
    autoDecision(true);
  }

  updateDisplay();
}

function addLog(message) {
  const log = $("logList");
  const item = document.createElement("span");
  item.textContent = `${new Date().toLocaleTimeString("id-ID", {hour:"2-digit", minute:"2-digit"})} · ${message}`;
  log.prepend(item);
  while (log.children.length > 6) log.lastElementChild.remove();
}

function autoDecision(manualTrigger = false) {
  const vehicle = vehicles[vehicleKey];
  const proportion = throttle / 100;
  const upLimit = vehicle.lowUp + proportion * (vehicle.highUp - vehicle.lowUp);
  const downLimit = vehicle.lowDown + proportion * (vehicle.highDown - vehicle.lowDown);

  if (delay > 0) {
    delay--;
    return;
  }

  let action = "-";
  const oldGear = gear;

  if (rpm >= upLimit && gear < vehicle.ratios.length) {
    gear++;
    action = "NAIK";
  } else if (rpm <= downLimit && gear > 1) {
    const newRPM = rpmAtSpeed(vehicle, speed, gear - 1);
    if (newRPM < vehicle.red * 0.9) {
      gear--;
      action = "TURUN";
    }
  }

  if (throttle >= 85 && gear > 1) {
    const kickdownRPM = rpmAtSpeed(vehicle, speed, gear - 1);
    if (kickdownRPM < vehicle.red * 0.9 && rpm < vehicle.highUp * 0.75) {
      gear--;
      action = "KICKDOWN";
    }
  }

  if (gear !== oldGear) {
    rpm = rpmAtSpeed(vehicle, speed, gear);
    delay = 3;
  }

  $("shiftStat").textContent = action;
  if (action !== "-" || manualTrigger) {
    addLog(action === "-" ? "Tidak ada perpindahan gigi." : `${action} ke gigi ${gear}.`);
  }

  updateDisplay();
}

function startAutomatic() {
  if (running) stopAutomatic();

  running = true;
  const vehicle = vehicles[vehicleKey];
  const sprite = $("vehicleSprite");

  speed = 5;
  gear = 1;
  throttle = 40;
  rpm = rpmAtSpeed(vehicle, speed, gear);

  elements.speedInput.value = Math.round(speed);
  elements.throttleInput.value = throttle;
  sprite.classList.add("moving");
  $("track").classList.add("moving");
  $("launchBtn").textContent = "■ HENTIKAN SIMULASI";

  const timeline = [50, 70, 30, 100, 0, 50];
  let step = 0;
  let second = 0;

  timer = setInterval(() => {
    if (step >= timeline.length) step = 0;
    throttle = timeline[step];

    const pull = throttle / 100 * vehicle.pull[gear - 1];
    const resistance = vehicle.drag * speed + (throttle === 0 ? 0.4 : 0);
    speed = Math.max(0, speed + pull - resistance);
    if (throttle > 0) speed = Math.max(speed, 3);

    rpm = rpmAtSpeed(vehicle, speed, gear);
    if (++second % 5 === 0) step++;

    autoDecision();
    elements.speedInput.value = Math.round(speed);
    elements.throttleInput.value = throttle;
    updateDisplay();
  }, 300);
}

function stopAutomatic() {
  running = false;
  clearInterval(timer);
  timer = null;
  $("vehicleSprite").classList.remove("moving");
  $("track").classList.remove("moving");
  $("launchBtn").textContent = "🏁 MULAI SIMULASI";
  addLog("Simulasi otomatis dihentikan.");
}

Object.values(elements).forEach(element => {
  element.addEventListener("input", updateInputs);
});

$("analyzeBtn").addEventListener("click", analyze);

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(item => item.classList.remove("active"));
    tab.classList.add("active");
    mode = tab.dataset.mode;
    document.querySelector(".manual-only").style.display = mode === "manual" ? "block" : "none";
    stopAutomatic();
  });
});

document.querySelectorAll(".vehicle").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".vehicle").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    vehicleKey = button.dataset.vehicle;

    const sprite = $("vehicleSprite");
    sprite.className = `vehicle-sprite ${vehicleKey}`;
    if (running) sprite.classList.add("moving");

    const motor = vehicleKey === "motor";
    elements.rpmInput.max = motor ? 11000 : 7000;
    elements.rpmInput.value = motor ? 6500 : 4200;
    elements.speedInput.value = motor ? 100 : 120;
    updateInputs();
    addLog(`${vehicles[vehicleKey].name} dipilih.`);
  });
});

$("launchBtn").addEventListener("click", () => {
  if (mode !== "automatic") {
    addLog("Berpindah ke Automatic untuk menjalankan simulasi.");
    document.querySelector('[data-mode="automatic"]').click();
  }

  running ? stopAutomatic() : startAutomatic();
});

updateInputs();