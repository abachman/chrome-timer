// connect to timer app in background process
var bg    = chrome.extension.getBackgroundPage(),
    timer = bg.app;

var Display = function (masterTimer) {
  this.startButton = $('#start_button');
  this.resetButton = $('#reset_button');
  this.resetPreview = $('#reset-preview');
  this.alarmCheck  = $('#alarm_check');
  this.alarmButton = $('#alarm_button');
  this.alarmIndicator = $('#alarm_indicator');
  this.master = masterTimer;
  this.editable = $('.editable');

  console.log('check master?', masterTimer);

  this.initialize();
}

Display.prototype.initialize = function () {
  this.setPrimaryTime(this.master.state.displayTime);
  this.setResetTime(this.master.state.defaultDisplayTime);

  if (this.master.settings.soundAlarm) {
    this.alarmOn(true);
  } else {
    this.alarmOff(true);
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
      self.alarmOn(false);
    } else {
      self.alarmOff(false);
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

  // reset button
  this.resetButton.on('click', function () {
    if (!self.master.isRunning()) {
      self.reset();
    }
  });

  this.resetButton.on('mouseover', function () {
    if (!$(this).is('.disabled') && (
        $('#hours').text() != self.master.state.defaultDisplayTime.hours ||
        $('#minutes').text() != self.master.state.defaultDisplayTime.minutes ||
        $('#seconds').text() != self.master.state.defaultDisplayTime.seconds)) {
      self.setResetTime(self.master.state.defaultDisplayTime);
      self.resetPreview.addClass('hover');
    }
  });

  this.resetButton.on('mouseout', function () {
    self.resetPreview.removeClass('hover');
  });

  // editable field behaviors
  this.editable.
    blur(function () {
      // sanitize
      var value = $(this).text()
      if (value.length === 0 || Number(value) === 0) {
        $(this).text('00')
      } else if (!/^[0-9]{1,2}$/.test(value)) {
        value = value.replace(/[^0-9]/,'').substr(0,2)
        $(this).text(value)
      } else {
        // prepend single digit numbers with a zero
        value = ((Number(value) < 10) ? '0' : '') + Number(value)
        $(this).text(value)
      }
    }).
    click(function (evt) {
      evt.stopPropagation();

      // ignore clicks while timer is active
      if (self.master.isRunning()) return;

      if (!$(this).attr('contenteditable')) {
        self.makeEditable();
      }

      $(this).focus();

      setTimeout(self.selectAll, 1);
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
        }

        self.deferredSelectAll();
      }
    }
  }

  // tab and shift-tab while editing time fields
  $('#hours').on(  'keydown', moveOnTab($('#minutes'), $('#seconds')));
  $('#minutes').on('keydown', moveOnTab($('#seconds'), $('#hours')));
  $('#seconds').on('keydown', moveOnTab($('#hours'), $('#minutes')));

  $('#main-popup').on('click', function () {
    $('.editable').blur();
    self.makeStatic();
  });

  $(document).on('keyup', function (evt) {
    console.log('document.keyup got ' + KEY_NAMES[evt.which]);

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

Display.prototype.setResetTime = function (time) {
  $('#hours-reset').text(time.hours);
  $('#minutes-reset').text(time.minutes);
  $('#seconds-reset').text(time.seconds);
}

Display.prototype.runningMode = function () {
  this.startButton.
    text('stop').
    addClass('btn-danger').
    removeClass('btn-success');

  this.resetButton.
    addClass('disabled');

  this.makeStatic();
}

Display.prototype.pauseMode = function () {
  this.startButton.text('start').
    removeClass('btn-danger').
    addClass('btn-success');

  this.resetButton.
    removeClass('disabled');
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
  this.alarmCheck.prop('checked', true);
  this.alarmButton.addClass('active');
  if (!skipFade) {
    this.changeAlarmStateAndFade('on');
  }
}

Display.prototype.alarmOff = function (skipFade) {
  this.alarmCheck.prop('checked', false);
  this.alarmButton.removeClass('active');

  if (!skipFade) {
    this.changeAlarmStateAndFade('off');
  }
}

Display.prototype.selectAll = function () {
  document.execCommand('selectAll',false,null);
}

Display.prototype.deferredSelectAll = function () {
  setTimeout(this.selectAll, 1);
}

////
//// ON LOAD
////

var display = new Display(timer);

// listen for the ticking of the clock while the popup is open
chrome.extension.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.type == 'second') {
    display.setPrimaryTime(message.time);
  } else if (message.type == 'finish') {
    display.pauseMode();
  }
});

$('.editable').blur();

