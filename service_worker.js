/* global chrome */

// Timer state constants
const TIMER_RUNNING = "running"
const TIMER_STOPPED = "stopped"

// Default timer state
const defaultState = {
  status: TIMER_STOPPED,
  time: {
    hours: 0,
    minutes: 5,
    seconds: 0,
  },
  displayTime: {
    hours: "00",
    minutes: "05",
    seconds: "00",
  },
  defaultTime: {
    hours: 0,
    minutes: 5,
    seconds: 0,
  },
  defaultDisplayTime: {
    hours: "00",
    minutes: "05",
    seconds: "00",
  },
  settings: {
    soundAlarm: true,
  },
}

// Current timer state (in-memory)
let currentState = null

// Alarm name for the timer
const TIMER_ALARM = "timer_tick"

// Initialize state from storage or use defaults
async function initializeState() {
  const result = await chrome.storage.local.get(["timerState"])
  if (result.timerState) {
    currentState = result.timerState
    // Resume running timer if it was running
    if (currentState.status === TIMER_RUNNING) {
      await resumeTimer()
    }
  } else {
    currentState = { ...defaultState }
    await saveState()
  }
}

// Save state to storage
async function saveState() {
  await chrome.storage.local.set({ timerState: currentState })
}

// Get displayable time string
function getDisplayableTime(time) {
  const dh = (time.hours < 10 ? "0" : "") + String(time.hours)
  const dm = (time.minutes < 10 ? "0" : "") + String(time.minutes)
  const ds = (time.seconds < 10 ? "0" : "") + String(time.seconds)
  return {
    hours: dh,
    minutes: dm,
    seconds: ds,
  }
}

// Convert time object to total seconds
function timeToSeconds(time) {
  return time.hours * 3600 + time.minutes * 60 + time.seconds
}

// Convert total seconds to time object
function secondsToTime(totalSeconds) {
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  }
}

// Clear the badge
function clearBadge() {
  chrome.action.setBadgeText({ text: "" })
  chrome.action.setBadgeBackgroundColor({ color: [255, 255, 255, 0] })
}

// Show timer finished badge
function showFinishedBadge() {
  chrome.action.setBadgeText({ text: " ! " })
  chrome.action.setBadgeBackgroundColor({ color: [255, 0, 0, 255] })
}

// Show countdown in badge
function showCountdownBadge(minutes, seconds) {
  chrome.action.setBadgeBackgroundColor({ color: [51, 51, 51, 255] })
  chrome.action.setBadgeText({ text: `${minutes}:${seconds}` })
}

// Play alarm sound using offscreen document
async function playAlarm() {
  if (!currentState.settings.soundAlarm) return

  try {
    // Create offscreen document if it doesn't exist
    const existingClients = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [chrome.runtime.getURL("offscreen.html")],
    })

    if (!existingClients.length) {
      await chrome.offscreen.createDocument({
        url: "offscreen.html",
        reasons: ["AUDIO_PLAYBACK"],
        justification: "Play alarm sound when timer finishes",
      })
    }

    // Send message to offscreen document to play sound
    await chrome.runtime.sendMessage({
      target: "offscreen",
      action: "playAlarm",
    })
  } catch (error) {
    console.error("Error playing alarm:", error)
  }
}

// Show notification
function notify(title, message) {
  const options = {
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/48.png"),
    title,
    message,
    silent: false,
  }
  chrome.notifications.create(options, (notificationId) => {
    if (chrome.runtime.lastError) {
      console.error("Error creating notification:", chrome.runtime.lastError)
    } else {
      console.log("Displayed notification", notificationId)
    }
  })
}

// Send state update to popup (if open)
function sendStateToPopup() {
  chrome.runtime
    .sendMessage({
      type: "stateUpdate",
      state: currentState,
    })
    .catch(() => {
      // Popup is not open, ignore error
    })
}

// Timer tick handler - called every second by alarm
async function onTimerTick() {
  if (currentState.status !== TIMER_RUNNING) return

  const totalSeconds = timeToSeconds(currentState.time)

  if (totalSeconds <= 0) {
    // Timer finished
    await stopTimer()
    showFinishedBadge()
    notify("Time's up!", "Countdown timer has finished.")
    await playAlarm()
    return
  }

  // Decrement time
  const newTotalSeconds = totalSeconds - 1
  currentState.time = secondsToTime(newTotalSeconds)
  currentState.displayTime = getDisplayableTime(currentState.time)

  // Update badge if under 1 hour
  if (currentState.time.hours <= 0 && currentState.time.minutes <= 59) {
    showCountdownBadge(currentState.time.minutes, currentState.displayTime.seconds)
  }

  // Send update to popup
  chrome.runtime
    .sendMessage({
      type: "tick",
      time: currentState.displayTime,
    })
    .catch(() => {
      // Popup is not open, ignore error
    })

  await saveState()
}

// Resume timer after service worker restart
async function resumeTimer() {
  const totalSeconds = timeToSeconds(currentState.time)
  if (totalSeconds > 0) {
    // Create alarm for each second tick
    await chrome.alarms.create(TIMER_ALARM, {
      periodInMinutes: 1 / 60, // 1 second
    })
  }
}

// Start the timer
async function startTimer(time) {
  // Update time if provided
  if (time) {
    currentState.time = time
    currentState.displayTime = getDisplayableTime(time)
    // Save as new default
    currentState.defaultTime = time
    currentState.defaultDisplayTime = getDisplayableTime(time)
  }

  clearBadge()
  currentState.status = TIMER_RUNNING

  const totalSeconds = timeToSeconds(currentState.time)

  if (totalSeconds <= 0) {
    // Timer finished immediately
    await stopTimer()
    showFinishedBadge()
    notify("Time's up!", "Countdown timer has finished.")
    await playAlarm()
    return
  }

  // Create alarm for each second tick
  await chrome.alarms.create(TIMER_ALARM, {
    periodInMinutes: 1 / 60, // 1 second
  })

  await saveState()
  sendStateToPopup()
}

// Stop the timer
async function stopTimer() {
  currentState.status = TIMER_STOPPED
  await chrome.alarms.clear(TIMER_ALARM)
  await saveState()
  sendStateToPopup()
}

// Reset the timer to default
async function resetTimer() {
  currentState.time = { ...currentState.defaultTime }
  currentState.displayTime = { ...currentState.defaultDisplayTime }
  currentState.status = TIMER_STOPPED
  clearBadge()
  await chrome.alarms.clear(TIMER_ALARM)
  await saveState()
  sendStateToPopup()
}

// Set time without starting
async function setTimerTime(time) {
  currentState.time = time
  currentState.displayTime = getDisplayableTime(time)
  // Update default time
  currentState.defaultTime = time
  currentState.defaultDisplayTime = getDisplayableTime(time)
  await saveState()
  sendStateToPopup()
}

// Toggle alarm sound
async function toggleAlarmSound(enabled) {
  currentState.settings.soundAlarm = enabled
  await saveState()
  sendStateToPopup()
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle messages intended for offscreen document - let them pass through
  if (message.target === "offscreen") {
    // Don't handle these messages in the service worker
    // Return true to allow message to propagate to offscreen document
    return true
  }

  // Handle action messages
  switch (message.action) {
    case "getState":
      sendResponse({ state: currentState })
      break

    case "start":
      startTimer(message.time).catch(console.error)
      break

    case "stop":
      stopTimer().catch(console.error)
      break

    case "reset":
      resetTimer().catch(console.error)
      break

    case "setTime":
      setTimerTime(message.time).catch(console.error)
      break

    case "toggleAlarm":
      toggleAlarmSound(message.enabled).catch(console.error)
      break

    case "clearBadge":
      clearBadge()
      break

    case "testAlarm":
      // Play test alarm sound (used when toggling alarm on)
      playAlarm().catch(console.error)
      sendResponse({ success: true })
      break
  }

  return true // Keep message channel open for async response
})

// Handle alarm ticks
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === TIMER_ALARM) {
    onTimerTick()
  }
})

// Initialize on install or startup
chrome.runtime.onInstalled.addListener(async () => {
  await initializeState()
})

chrome.runtime.onStartup.addListener(async () => {
  await initializeState()
})

// Initialize immediately for service worker restart
initializeState().catch(console.error)
