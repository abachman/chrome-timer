/* global chrome */

// Listen for messages from service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target === 'offscreen') {
    if (message.action === 'playAlarm') {
      playAlarm()
    }
  }
  return true
})

function playAlarm () {
  const alarm = new Audio(chrome.runtime.getURL('assets/wine-glass-alarm.ogg'))
  alarm.play().catch((error) => {
    console.error('Error playing alarm:', error)
  })
}
