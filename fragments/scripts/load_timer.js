var KEYS = {
  ENTER:  13,
  UP:     38,
  DOWN:   40,
  LEFT:   37,
  RIGHT:  39,
  ESCAPE: 27,
  SPACE:  32,
  CTRL:   17,
  ALT:    18,
  TAB:    9,
  SHIFT:  16,
  CAPS_LOCK: 20,
  WINDOWS_KEY: 91,
  WINDOWS_OPTION_KEY: 93,
  BACKSPACE: 8,
  HOME:      36,
  END:       35,
  INSERT:    45,
  DELETE:    46,
  PAGE_UP:   33,
  PAGE_DOWN: 34,
  NUMLOCK:   144,
  F1:        112,
  F2:        113,
  F3:        114,
  F4:        115,
  F5:        116,
  F6:        117,
  F7:        118,
  F8:        119,
  F9:        120,
  F10:       121,
  F11:       122,
  F12:       123,
  SCROLL:    145,
  PAUSE:     19
}

// connect to timer app in background process
var bg    = chrome.extension.getBackgroundPage(),
    timer = bg.app;

var Display = function (masterTimer) {
  this.startButton = $('#start_button');
  this.resetButton = $('#reset_button');
  this.alarmCheck  = $('#alarm_check');
  this.alarmButton = $('#alarm_button');
  this.master      = masterTimer;
  this.editable    = $('.editable');

  console.log('check master?', masterTimer);

  this.initialize();
}

Display.prototype.initialize = function () {
  console.log('check master again?', this.master);

  this.setPrimaryTime(this.master.state.displayTime);

  if (this.master.settings.soundAlarm) {
    this.alarmOn();
  } else {
    this.alarmOff();
  }

  // evaluate the state of the timer when the popup opens
  if (!this.master.isRunning()) {
    bg.clearBadge();
    this.pauseMode();
  } else {
    this.runningMode();
  }

  this.bindAll();
}

Display.prototype.makeEditable = function () {
  this.editable.attr('contenteditable', 'true')
}

Display.prototype.makeStatic = function () {
  this.editable.attr('contenteditable', null)
}

Display.prototype.bindAll = function () {
  var self = this;

  // toggle alarm setting
  this.alarmButton.on('click', function () {
    // set checkbox to its opposite state
    self.alarmCheck.prop('checked', !$(self.alarmCheck).is(':checked'));
    self.master.settings.soundAlarm = self.alarmCheck.is(':checked');
    if (self.alarmCheck.is(':checked')) {
      self.alarmOn();
    } else {
      self.alarmOff();
    }
  });

  // start / stop button
  this.startButton.on('click', function () {
    if (!self.master.isRunning()) {
      self.start();
    } else {
      self.stop();
    }
  });

  this.resetButton.on('click', function () {
    if (!self.master.isRunning()) {
      self.reset();
    }
  });

  this.editable.
    blur(function () {
      // sanitize
      var value = $(this).text()
      if (value.length == 0 || Number(value) == 0) {
        $(this).text('00')
      } else if (!/^[0-9]{1,2}$/.test(value)) {
        value = value.replace(/[^0-9]/,'').substr(0,2)
        $(this).text(value)
      } else {
        // prepend single digit numbers with a zero
        value = ((Number(value) < 10) ? '0' : '') + Number(value)
        $(this).text(value)
      }
      self.makeStatic();
    }).
    click(function (evt) {
      evt.stopPropagation();

      // ignore clicks while timer is active
      if (self.master.isRunning()) return;

      if (!$(this).attr('contenteditable')) {
        self.makeEditable();
      }
      $(this).focus();
    }).
    keydown(function (evt) {
      evt.stopPropagation();

      // sanitize
      var k = evt.keyCode
      if (k === KEYS.ESCAPE || k === KEYS.ENTER) {
        $(this).blur()
        evt.preventDefault()
      } else if (k === KEYS.SPACE) {
        evt.preventDefault()
      }
  });

  $('document, *').on('keydown', function (evt) {
    if (evt.which == KEYS.TAB) {
      evt.preventDefault();
    }
  });

  var moveOnTab = function (next, prev) {
    return function (evt) {
      if (evt.which == KEYS.TAB) {
        self.makeEditable();

        evt.preventDefault();
        evt.stopPropagation();

        if (evt.shiftKey) {
          // backwards
          prev.focus();
        } else {
          // forewards
          next.focus();
          self.selectAll();
        }

      }
    }
  }

  // tab and shift-tab while editing time fields
  $('#hours').on('keydown', moveOnTab($('#minutes'), $('#seconds')));
  $('#minutes').on('keydown', moveOnTab($('#seconds'), $('#hours')));
  $('#seconds').on('keydown', moveOnTab($('#hours'), $('#minutes')));

  $('#main-popup').on('click', function () {
    $('.editable').blur();
  });

  $(document).on('keyup', function (evt) {
    if (evt.which == KEYS.SPACE) {
      if (self.master.isRunning()) {
        self.stop();
      } else {
        self.start();
      }
    }
  });
}

Display.prototype.start = function () {
  var hours   = Number($('#hours').text()),
      minutes = Number($('#minutes').text()),
      seconds = Number($('#seconds').text())

  if (hours + minutes + seconds > 0) {
    this.runningMode();

    // set master timer and start counting down
    this.master.setTime({
      hours: hours,
      minutes: minutes,
      seconds: seconds
    })

    this.master.start()
  }
}

Display.prototype.reset = function () {
  this.master.reset();
}

Display.prototype.stop = function () {
  this.pauseMode();
  this.master.stop();
}

Display.prototype.setPrimaryTime = function (time) {
  $('#hours').text(time.hours);
  $('#minutes').text(time.minutes);
  $('#seconds').text(time.seconds);
}

Display.prototype.runningMode = function () {
  this.startButton.
    text('stop').
    addClass('btn-danger').
    removeClass('btn-success');

  this.resetButton.
    addClass('disabled');
}

Display.prototype.pauseMode = function () {
  this.startButton.text('start').
    removeClass('btn-danger').
    addClass('btn-success');

  this.resetButton.
    removeClass('disabled');
}

Display.prototype.alarmOn = function () {
  this.alarmCheck.prop('checked', true);
  this.alarmButton.addClass('active');
}

Display.prototype.alarmOff = function () {
  this.alarmCheck.prop('checked', false);
  this.alarmButton.removeClass('active');
}

Display.prototype.selectAll = function () {
  document.execCommand('selectAll',false,null);
}

////
//// ON LOAD
////

var display = new Display(timer);

$('.editable').on('click', function () {
  display.selectAll();
});

// listen for the ticking of the clock while the popup is open
chrome.extension.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.type == 'second') {
    display.setPrimaryTime(message.time);
  } else if (message.type == 'finish') {
    display.pauseMode();
  }
});

$('.editable').blur();
