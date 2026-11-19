const API = "http://127.0.0.1:8765";
const $ = id => document.getElementById(id);
let token = "";
async function loadToken() {
  const saved = await chrome.storage.local.get("agentToken");
  token = saved.agentToken || "";
  $("token").value = token;
}
async function request(path, options = {}) {
  const response = await fetch(API + path, {...options, headers: {
    "Content-Type":"application/json","X-Agent-Token":token,...(options.headers||{})
  }});
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Local agent request failed ("+response.status+")");
  return data;
}
function message(s) { $("message").textContent = s; }
async function refresh() {
  try {
    const data = await request("/status");
    $("dot").classList.add("ok");
    $("status").textContent = data.status;
    $("model").textContent = data.model;
    $("limit").textContent = data.max_hours+" hours";
    const result = await request("/logs");
    $("logs").textContent = result.logs.join("\n") || "No activity yet.";
    $("logs").scrollTop = $("logs").scrollHeight;
  } catch (e) {
    $("dot").classList.remove("ok");
    $("status").textContent = "Disconnected";
    $("logs").textContent = e.message+"\n\nStart the local backend with start.bat, then save its pairing token.";
  }
}
$("save").addEventListener("click", async () => {
  token = $("token").value.trim();
  await chrome.storage.local.set({agentToken:token});
  message("Connection token saved in this browser profile.");
  await refresh();
});
$("start").addEventListener("click", async () => {
  try {
    await request("/start",{method:"POST",body:JSON.stringify({task:$("task").value})});
    message("Agent started."); await refresh();
  } catch(e) { message(e.message); }
});
$("stop").addEventListener("click", async () => {
  try {
    await request("/stop",{method:"POST"});
    message("Stop requested. Current API operation may finish first."); await refresh();
  } catch(e) { message(e.message); }
});
$("refresh").addEventListener("click",refresh);
loadToken().then(refresh);
setInterval(refresh,4000);
