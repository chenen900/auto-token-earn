// Auto Remote Mode — idle detection + auto toggle
// 检测键鼠空闲 → 自动开/关远程模式
// 用法: node auto_remote.js
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const FLAG = path.join(__dirname, "data", "remote_mode_on");
const IDLE_THRESHOLD_MS = 5 * 60 * 1000; // 5分钟空闲 → 开启
const ACTIVE_THRESHOLD_MS = 30 * 1000;    // 30秒内有操作 → 关闭

function getIdleMs() {
  try {
    // PowerShell: 获取最后一次用户输入距今的毫秒数
    const result = execSync(
      'powershell -WindowStyle Hidden -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SystemInformation]::IdleTime.TotalMilliseconds"',
      { encoding: "utf8", timeout: 5000, windowsHide: true }
    );
    return parseInt(result) || 0;
  } catch(e) {
    return 0;
  }
}

function isRemoteOn() { return fs.existsSync(FLAG); }
function turnOn() { fs.writeFileSync(FLAG, new Date().toISOString()); }
function turnOff() { try { fs.unlinkSync(FLAG); } catch(e) {} }

function now() { return new Date().toLocaleTimeString(); }

console.log("[AutoRemote] 启动 | 空闲" + IDLE_THRESHOLD_MS/60000 + "分钟自动开 | 检测到操作自动关");

let wasActive = true;

setInterval(() => {
  const idle = getIdleMs();
  const remote = isRemoteOn();

  if (idle > IDLE_THRESHOLD_MS && !remote && wasActive) {
    turnOn();
    console.log("[" + now() + "] 检测到空闲 " + Math.floor(idle/60000) + "分钟 → 远程模式 开启");
    wasActive = false;
  } else if (idle < ACTIVE_THRESHOLD_MS && remote && !wasActive) {
    turnOff();
    console.log("[" + now() + "] 检测到用户操作 → 远程模式 关闭");
    wasActive = true;
  } else if (idle < ACTIVE_THRESHOLD_MS) {
    wasActive = true;
  }
}, 30000);
