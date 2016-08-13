'use strict'

const fastq = require('fastq')
const EE = require('events').EventEmitter
const inherits = require('inherits')

function Boot (server, done) {
  if (!(this instanceof Boot)) {
    return new Boot(server, done)
  }

  if (typeof server === 'function') {
    done = server
    server = null
  }

  server = server || this

  this._queue = fastq(server, (toLoad, cb) => {
    const func = toLoad.plugin
    func(server, toLoad.opts, (err) => {
      // schedule all tasks left in the batch
      clear(this)

      // always delay the next task
      process.nextTick(cb, err)
    })
  }, 1)

  if (done) {
    this.on('start', done)
  }

  this._queue.drain = () => {
    this.emit('start')
  }

  this._batch = null
  this.use(nooplugin)
}

inherits(Boot, EE)

Boot.prototype.use = function (plugin, opts) {
  opts = opts || {}

  const obj = {
    plugin,
    opts
  }

  if (this._batch) {
    this._batch.push(obj)
  } else {
    this._batch = [obj]
    // add all the current batch in the next tick
    process.nextTick(clear, this)
  }
}

// add all element in the batch at the top of the
// queue, in the order that they are called with use()
function clear (boot) {
  // needed if the plugin loads sync
  if (!boot._batch) {
    return
  }

  // reverse the batch
  const batch = boot._batch.reverse()
  boot._batch = null

  // we need to pause, otherwise one of the jobs might be triggered
  // and we will trigger the wrong one, because we are adding them
  // at the top
  boot._queue.pause()
  batch.forEach((obj) => boot._queue.unshift(obj))
  boot._queue.resume()
}

function nooplugin (s, o, done) {
  done()
}

module.exports = Boot
