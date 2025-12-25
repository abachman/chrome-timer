/* global chrome, $, KEYS, KEY_NAMES */

// Timer state from service worker
let timerState = null

// Send message to service worker and get response
async function sendMessage (message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Message error:', chrome.runtime.lastError)
        resolve(null)
      } else {
        resolve(response)
      }
    })
  })
}

// Get current timer state from service worker
async function getState () {
  const response = await sendMessage({ action: 'getState' })
  if (response && response.state) {
    timerState = response.state
  }
}

const Display = function () {
  this.startButton = $('#start_button')
  this.resetButton = $('#reset_button')
  this.resetPreview = $('#reset-preview')
  this.alarmCheck = $('#alarm_check')
  this.alarmButton = $('#alarm_button')
  this.alarmIndicator = $('#alarm_indicator')

  console.log('check state?', timerState)

  this.initialize()
}

Display.prototype.initialize = async function () {
  // Get initial state from service worker
  await getState()

  this.setPrimaryTime(timerState.displayTime)
  this.setResetTime(timerState.defaultDisplayTime)

  if (timerState.settings.soundAlarm) {
    this.alarmOn(true)
  } else {
    this.alarmOff(true)
  }

  // evaluate the state of the timer when the popup opens
  if (timerState.status !== 'running') {
    this.clearBadge()
    this.pauseMode()
  } else {
    this.runningMode()
  }

  this.bindAll()
}

Display.prototype.makeEditable = function () {
  this.editable.attr('contenteditable', 'true')
}

Display.prototype.makeStatic = function () {
  this.editable.attr('contenteditable', null)
}

Display.prototype.bindAll = function () {
  const self = this

  // toggle alarm setting
  this.alarmButton.on('click', function () {
    // set checkbox to its opposite state
    self.alarmCheck.prop('checked', !$(self.alarmCheck).is(':checked'))
    const enabled = self.alarmCheck.is(':checked')
    // Update state and send to service worker
    timerState.settings.soundAlarm = enabled
    sendMessage({ action: 'toggleAlarm', enabled })
    if (self.alarmCheck.is(':checked')) {
      self.alarmOn(false)
      // Play test sound when enabling alarm
      sendMessage({ action: 'testAlarm' })
    } else {
      self.alarmOff(false)
    }
  })

  // start / stop button
  this.startButton.on('click', function () {
    if (timerState.status !== 'running') {
      self.start()
    } else {
      self.stop()
    }
  })

  // reset button
  this.resetButton.on('click', function () {
    if (timerState.status !== 'running') {
      self.reset()
    }
  })

  this.resetButton.on('mouseover', function () {
    if (!$(this).is('.disabled') && (
      $('#hours').text() !== timerState.defaultDisplayTime.hours ||
        $('#minutes').text() !== timerState.defaultDisplayTime.minutes ||
        $('#seconds').text() !== timerState.defaultDisplayTime.seconds)) {
      self.setResetTime(timerState.defaultDisplayTime)
      self.resetPreview.addClass('hover')
    }
  })

  this.resetButton.on('mouseout', function () {
    self.resetPreview.removeClass('hover')
  })

  // editable field behaviors
  this.editable = $('.editable')

  this.editable
    .blur(function () {
      // sanitize
      let value = $(this).text()
      if (value.length === 0 || Number(value) === 0) {
        $(this).text('00')
      } else if (!/^[0-9]{1,2}$/.test(value)) {
        value = value.replace(/[^0-9]/, '').substr(0, 2)
        $(this).text(value)
      } else {
        // prepend single digit numbers with a zero
        value = ((Number(value) < 10) ? '0' : '') + Number(value)
        $(this).text(value)
      }
    })
    .click(function (evt) {
      evt.stopPropagation()

      // ignore clicks while timer is active
      if (timerState.status === 'running') return

      if (!$(this).attr('contenteditable')) {
        self.makeEditable()
      }

      $(this).focus()

      setTimeout(self.selectAll, 1)
    })
    .keydown(function (evt) {
      evt.stopPropagation()

      // sanitize
      const k = evt.keyCode
      if (k === KEYS.ESCAPE || k === KEYS.ENTER) {
        $(this).blur()
        evt.preventDefault()
      } else if (k === KEYS.SPACE) {
        evt.preventDefault()
      }
    })

  const moveOnTab = function (next, prev) {
    return function (evt) {
      if (evt.which === KEYS.TAB) {
        self.makeEditable()

        evt.preventDefault()
        evt.stopPropagation()

        if (evt.shiftKey) {
          // backwards
          prev.focus()
        } else {
          // forewards
          next.focus()
        }

        self.deferredSelectAll()
      }
    }
  }

  // tab and shift-tab while editing time fields
  $('#hours').on('keydown', moveOnTab($('#minutes'), $('#seconds')))
  $('#minutes').on('keydown', moveOnTab($('#seconds'), $('#hours')))
  $('#seconds').on('keydown', moveOnTab($('#hours'), $('#minutes')))

  $('#main-popup').on('click', function () {
    $('.editable').blur()
    self.makeStatic()
  })

  $(document).on('keyup', function (evt) {
    console.log('document.keyup got ' + KEY_NAMES[evt.which])

    if (evt.which === KEYS.SPACE) {
      if (timerState.status === 'running') {
        self.stop()
      } else {
        self.start()
      }
    }
  })
}

Display.prototype.start = function () {
  const hours = Number($('#hours').text())
  const minutes = Number($('#minutes').text())
  const seconds = Number($('#seconds').text())

  if (hours + minutes + seconds > 0) {
    this.runningMode()

    // Send start command to service worker
    sendMessage({
      action: 'start',
      time: {
        hours,
        minutes,
        seconds
      }
    })

    // Update local state
    timerState.status = 'running'
  }
}

Display.prototype.reset = function () {
  sendMessage({ action: 'reset' })
  // Update local state
  timerState.time = { ...timerState.defaultTime }
  timerState.displayTime = { ...timerState.defaultDisplayTime }
  timerState.status = 'stopped'
}

Display.prototype.stop = function () {
  this.pauseMode()
  sendMessage({ action: 'stop' })
  // Update local state
  timerState.status = 'stopped'
}

Display.prototype.setPrimaryTime = function (time) {
  $('#hours').text(time.hours)
  $('#minutes').text(time.minutes)
  $('#seconds').text(time.seconds)
}

Display.prototype.setResetTime = function (time) {
  $('#hours-reset').text(time.hours)
  $('#minutes-reset').text(time.minutes)
  $('#seconds-reset').text(time.seconds)
}

Display.prototype.runningMode = function () {
  this.startButton
    .text('stop')
    .addClass('btn-danger')
    .removeClass('btn-success')

  this.resetButton
    .addClass('disabled')

  this.makeStatic()
}

Display.prototype.pauseMode = function () {
  this.startButton.text('start')
    .removeClass('btn-danger')
    .addClass('btn-success')

  this.resetButton
    .removeClass('disabled')
}

Display.prototype.changeAlarmStateAndFade = function (state) {
  // this.alarmIndicator.find('.state').text(state);
  // this.alarmIndicator.
  //   show().
  //   animate({opacity: 0}, 1000, function () {
  //     $(this).hide();
  //     $(this).css({opacity: 1});
  //   });
}

Display.prototype.alarmOn = function (skipFade) {
  this.alarmCheck.prop('checked', true)
  this.alarmButton.addClass('active')
  if (!skipFade) {
    this.changeAlarmStateAndFade('on')
  }
}

Display.prototype.alarmOff = function (skipFade) {
  this.alarmCheck.prop('checked', false)
  this.alarmButton.removeClass('active')

  if (!skipFade) {
    this.changeAlarmStateAndFade('off')
  }
}

Display.prototype.selectAll = function () {
  document.execCommand('selectAll', false, null)
}

Display.prototype.deferredSelectAll = function () {
  setTimeout(this.selectAll, 1)
}

Display.prototype.clearBadge = function () {
  sendMessage({ action: 'clearBadge' })
}

/// /
/// / ON LOAD
/// /

const display = new Display()

// listen for messages from service worker
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.type === 'tick') {
    display.setPrimaryTime(message.time)
  } else if (message.type === 'stateUpdate') {
    timerState = message.state
  }
})

$('.editable').blur()
