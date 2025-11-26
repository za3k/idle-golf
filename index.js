const IMPULSE = 6
const FRICTION_SLOWDOWN = 1 // Scale this with impulse.

// Equal-size ball combo merging -- would require collision, probably won't do

function scale(k, v1) {
    return { x: k*v1.x, y: k*v1.y }
}
function add(v1, v2) {
    return { x: v1.x + v2.x, y: v1.y + v2.y, }
}
function sub(v1, v2) { return add(v1, scale(-1, v2)) }
function mag(v1) { return Math.sqrt(v1.x*v1.x + v1.y*v1.y) }
function dist(v1, v2) { return mag(sub(v1, v2)) }
function unitVector(v1) { return scale(1/mag(v1), v1) }
function vec2angle(vec) { return Math.atan2(vec.y, vec.x) }
function unitAngle(rads) { return { x: Math.cos(rads), y: Math.sin(rads) } }
function rotate(vec, rads) {
    return scale(mag(vec), unitAngle(vec2angle(vec) + rads))
}
function limitMag(v1, maxMag) {
    return scale(Math.min(mag(v1), maxMag), unitVector(v1))
}


function randRange(min, max) { return min + Math.random() * (max-min) }
function randChoice(arr) { return arr[randInt(0, arr.length)] }
function randInt(minInc, maxExc) {
    return Math.floor(randRange(minInc, maxExc-0.00001))
}

function assert(cond, error) {
    if (!cond) {
        throw new Error(`AssertionError: ${error}`)
    }
}

const canvas = $("canvas")[0]
var now = new Date()
const state = {
    balls: [],
    mouse: {
        pt: { x: 0, y: 0 },
        holdStartTs: null,
        isHeld: 0,
        mode: "plan",
    },
    level: {
        // The level is a polygon
        border: [
            // Clockwise order
            { x: 10, y: 0 },
            { x: 10, y: 10 },
            { x: 2, y: 10 },
            { x: 1, y: 11 },
            { x: 1, y: 12 },
            { x: 2, y: 13 },
            { x: 12, y: 13 },
            { x: 14, y: 11 },
            { x: 14, y: 0 },
            { x: 10, y: 0 },
        ],
        start: {
            x: 13,
            y: 1,
            //x: 4, y: 11.1,
        },
        hole: {
            x: 3,
            y: 11,
        },
    },
    numbers: {
        money: 0,
            // DONE: Buy upgrades
            // DONE: Grey out unbuyable things
        jackpot: 0,
            // DONE: Increase on every putt
            // DONE: Win on hole-in-one
        numBallsCurrent: 0,
        numBallsMax: 1,
            // DONE: When this increases, add a ball, actually test multiball
        friction: 1,
            // DONE: Make this higher to start
        jackpotEnabled: false,
            // DONE: Hide display, buy options until enabled
        manualPuttMax: 1,
        jackpotMinimum: 0,
            // DONE: On winning the jackpot, reset to this value
            // DONE: On upgrading the minimum, set it to this value
        jackpotRate: 1,
            // DONE: This is how much the jackpot should increase by on a putt
        holePayout: 1,
        manualPuttPower: 1,
            // DONE: Actually restrict putt power
        autoPuttEnabled: false,
            // DONE: Do auto-putts
        autoPuttCooldown: 8,
            // DONE: Have a cooldown
        autoPuttPower: 0.1,
            // DONE: Use this instead of a const
        autoPuttAim: 0.5,
            // DONE: Use the direction of the hole, plus a random offset
        globalMult: 1,
            // DONE: jackpot, hole sink
        comboEnabled: false,
        comboReductionPerPutt: 1,
            // DONE: Reduce combo on putt (minimum x1)
        comboIncreasePerSink: 1,
            // DONE: Increase combo on hole-in-one (per ball)
        won: false,
    },
    lastAutoPutt: new Date(),
    upgrades: {
        numBallsMax: [ 
            [2, 2],
        ], friction: [
            [1, 0],
        ], jackpotMinimum: [
            [1, 2],
        ], jackpotRate: [
            [10, 2],
        ], holePayout: [
            [10, 2],
            [20, 3],
            [30, 4],
            [40, 5],
        ], manualPuttPower: [
            [40, 1.5],
            [80, 2],
        ], manualPuttMax: [
            [1, 2],
            [2, 3],
            [3, 4],
            [4, 5],
        ], autoPuttEnabled: [
            [3, true]
        ], autoPuttCooldown: [
            [1, 4],
            [1, 2],
            [1, 1],
        ], autoPuttPower: [
        ], autoPuttAim: [
            [1, 0.01],
        ], jackpotEnabled: [
            [1000, true],
        ], globalMult: [
        ], comboEnabled: [
            [100, true],
        ], comboReductionPerPutt: [
        ], comboIncreasePerSink: [
        ], won: [
            [1000000, true],
        ],

    },
}

var offsetUnits = { x:0, y: 0 }
var units = 0
var level2units = 1
function resizeCanvas() {
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    const xs = state.level.border.map(pt => pt.x)
    const ys = state.level.border.map(pt => pt.y)
    units = Math.min(canvas.height, canvas.width) / 30
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    var levelWidth  = maxX-minX
    var levelHeight = maxY-minY
    const levelSize = Math.max(levelWidth, levelHeight)
    level2units = 20 / levelSize // Level should be 20 units tall/long
    levelWidth = levelWidth * level2units
    levelHeight = levelHeight * level2units

    const canvasWidth = canvas.width / units
    const canvasHeight = canvas.height / units
    offsetUnits = {
        x: (canvasWidth  / 2) - (levelWidth /2),
        y: (canvasHeight / 2) - (levelHeight/2),
    }
}
function toPx(pt) {
    return [
        (pt.x*level2units+offsetUnits.x)*units,
        (pt.y*level2units+offsetUnits.y)*units,
    ]
}
function toLevel(pt) {
    return {
        x: ((pt[0]/units) - offsetUnits.x) / level2units,
        y: ((pt[1]/units) - offsetUnits.y) / level2units,
    }
}

function mirror(thing, mirror) {
    return add(mirror, sub(mirror, thing))
}

function mouse(e) {
    e = e.originalEvent
    var pt
    if (e.offsetX) {
        pt = toLevel([e.offsetX, e.offsetY])
    } else if (e.touches && e.touches[0]) {
        pt = toLevel([
            e.touches[0].clientX - canvas.clientLeft,
            e.touches[0].clientY - canvas.clientTop,
        ])
    }

    if (e.type == "mousemove") {
        state.mouse.pt = pt   
    } else if (e.type == "mousedown") {
        state.mouse.pt = pt
        state.mouse.holdStartTs = new Date()
        state.mouse.held = true
    } else if (e.type == "mouseup") {
        state.mouse.holdStartTs = null
        state.mouse.held = false
        manualPutt()
    } else if (e.type == "touchstart") {
        state.mouse.pt = pt
        state.mouse.held = true
        state.mouse.holdStartTs = new Date()
        e.preventDefault()
    } else if (e.type == "touchmove") {
        state.mouse.pt = pt
    } else if ((e.type == "touchend" || e.type == "touchcancel") && e.touches.length == 0) {
        state.mouse.holdStartTs = null
        state.mouse.held = false
        manualPutt()
    } else {
        debugger;
    }
}

function tick() {
    const now2 = new Date()
    const elapsed = Math.min(now2 - now, 100) // Never simulate more than 0.1s. No particular reason, just things kept whizzing off screen while testing otherwise.
    now = now2

    physicsTick(elapsed/1000)
    redraw()
    if (state.numbers.won) clearInterval(tickInterval)
}

function updateMouseMode() {
    // Called whenever the current ball is in motion, stops, or at the beginning of the game
    if (state.manualBall && mag(state.manualBall.vel) == 0) {
        // The current ball is a fine ball to have focused.
        state.mouse.mode = "plan"
    } else {
        // Search for a new ball to switch to
        state.mouse.mode = "simulate"
        for (const ball of state.balls) {
            if (mag(ball.vel) == 0) {
                state.manualBall = ball
                state.mouse.mode = "plan"
                break
            }
        }
    }

    redraw() // Clear the mouse real quick.
}

function manualPutt() {
    if (state.mouse.mode != "plan") return

    // Instantaneously impart velocity
    const ball = state.manualBall
    const impulse = limitMag(sub(state.mouse.pt, ball.pt), state.numbers.manualPuttMax)
    ball.vel = scale(-IMPULSE * state.numbers.manualPuttPower, impulse)
    ball.numPutts++

    updateMouseMode()
}

function lineSegments(poly) {
    var res = []
    for (var i=0; i<poly.length-1; i++) {
        res.push([poly[i], poly[i+1]])
    }
    return res
}

function slope(seg) {
    const [{x: x1, y: y1}, {x: x2, y: y2}] = seg
    if (x1 > x2 || x1 == x2 && y1 > y2) return slope([seg[1], seg[0]])
    const [dx, dy] = [x2-x1, y2-y1]
    const m = dy/dx
    const b = y1 - m*x1
    return [m, b]
}

function intersect(seg1, seg2) {
    // Return the intersection if it exists, or null if not

    // Find the (infinite) lines the segments are part of
    const [mx1, b1] = slope(seg1)
    const [mx2, b2] = slope(seg2)

    // Find the intersection of the lines
    var point = null
    if (mx1 == mx2 || Number.isNaN(mx1) && Number.isNaN(mx2) || !Number.isFinite(mx1) && !Number.isFinite(mx2)) {
        return null // Same slope. Unlikely enough we'll just ignore it.
    } else if (Number.isNaN(mx1) || Number.isNaN(mx2)) {
        return null // Only happens if the two endpoints are the same -- should be an error
    // Special cases of one vertical line (dx=0, x constant)
    } else if (!Number.isFinite(mx1)) { 
        const x = seg1[0].x
        point = { x, y: mx2*x + b2 }
    } else if (!Number.isFinite(mx2)) { 
        const x = seg2[0].x
        point = { x, y: mx1*x + b1 }
    } else {
        // The normal case -- two intersecting lines
        const x = (b2-b1) / (mx1-mx2)
        const y = mx1*x + b1
        point = { x, y }
    }

    // Check whether the given point is on the segments
    // We already know it's on the line, so just make sure it's within the X bounds and Y bounds for each.
    const eps = 0.0001
    if (point.y-eps > Math.max(seg1[0].y, seg1[1].y)) return false
    if (point.y+eps < Math.min(seg1[0].y, seg1[1].y)) return false
    if (point.y-eps > Math.max(seg2[0].y, seg2[1].y)) return false
    if (point.y+eps < Math.min(seg2[0].y, seg2[1].y)) return false
    if (point.x-eps > Math.max(seg1[0].x, seg1[1].x)) return false
    if (point.x+eps < Math.min(seg1[0].x, seg1[1].x)) return false
    if (point.x-eps > Math.max(seg2[0].x, seg2[1].x)) return false
    if (point.x+eps < Math.min(seg2[0].x, seg2[1].x)) return false
    return point
}
assert(!!intersect([{x: 9.75, y: 12.97}, {x: 9.74, y: 13.01}], [{x: 2, y:13}, {x:12, y:13}]), "Intersection failed")
assert(!!intersect(
    [{x: 8.24878, y: 10.00511}, {x: 8.226582, y: 9.964496}],
    [{ x: 10, y: 10 },{ x: 2, y: 10 }]),
    "Intersection failed")



function doCollision(moveVector, wall) {
    // The move intersects the given wall. Elastically collide off it, and return the post-collision moveVector, assuming no other collisions.
    const [start, end1] = moveVector
    const mid = intersect(moveVector, wall)

    const remainingDist = dist(start, end1) - dist(start, mid)

    const wallAngle = vec2angle(sub(wall[1], wall[0]))
    const moveUnitVec = unitVector(sub(moveVector[1], moveVector[0]))
    
    const v1 = rotate(moveUnitVec, -wallAngle)
    const v2 = { x: v1.x, y: -v1.y }
    const v3 = rotate(v2, +wallAngle)
    const postReflectMove = scale(remainingDist, v3)

    return [
        mid,
        add(mid, postReflectMove)
    ]
}

function physicsTick(elapsed) {
    for (const ball of state.balls) {
        assert(!Number.isNaN(ball.pt.x))
        assert(!Number.isNaN(ball.vel.x))
        const move = scale(elapsed, ball.vel)

        // Stationary balls
        if (mag(move) == 0) {
            updateMouseMode()
            continue
        }

        // Update the ball
        var pos = ball.pt
        var target = add(ball.pt, move)
        const [origPos, origTarget] = [pos, target]
        const segments = lineSegments(state.level.border)


        // Collide and reflect off walls
        var collision = false
        var ignoreSegment = null
        var numCollisions = 0
        do {
            // Check for collision with any wall
            collision = false
            for (var segment of segments) {
                if (segment == ignoreSegment) continue
                if (intersect([pos, target], segment)) {
                    collision = true
                    ignoreSegment = segment;
                    [pos, target] = doCollision([pos, target], segment)
                    numCollisions += 1
                    break
                }
            }
        } while (collision)

        assert(!Number.isNaN(ball.pt.x))
        assert(!Number.isNaN(ball.vel.x))
        ball.pt = target

        // Change velocity direction too.
        const finalDir = unitVector(sub(target, pos))
        var speed = mag(ball.vel)

        // Apply friction slowdown
        slowdown = FRICTION_SLOWDOWN * state.numbers.friction * Math.max(speed, 2)
        speed = Math.max(0, speed - slowdown * elapsed)
        ball.vel = scale(speed, finalDir)

        // Land a ball in the hole
        if (dist(ball.pt, state.level.hole) < 0.10) {
            ballSunk(ball)
        }

        if (!insidePoly(ball.pt, state.level.border)) {
            displayTop("Whoops! Ball flew out of bounds", "red")
            respawnBall(ball)
        }

        if (speed == 0) {
            ballStopped(ball)
        }
    }

    if (state.numbers.autoPuttEnabled && state.balls.length > 1) {
        const now = new Date()
        const timeSinceAutoPutt = (now - state.lastAutoPutt) / 1000
        if (timeSinceAutoPutt > state.numbers.autoPuttCooldown) {
            autoPutt()
            state.lastAutoPutt = now
        }
    }
}

function autoPutt() {
    if (state.balls.length <= 1) return

    var tries = 0
    do {
        ball = randChoice(state.balls)
        tries++
        if (tries > 10) return
    } while (ball == state.manualBall || mag(ball.vel) > 0)

    // Instantaneously impart velocity
    const perfectDir = unitVector(sub(ball.pt, state.level.hole))
    const randomOffset = randRange(-1, 1) * Math.PI * state.numbers.autoPuttAim
    const actualDir = rotate(perfectDir, randomOffset)
    const speed = state.numbers.autoPuttPower * randRange(0.5, 1)
    const impulse = scale(IMPULSE * speed, actualDir)

    ball.vel = scale(-IMPULSE * state.numbers.manualPuttPower, impulse)
    ball.numPutts++

    updateMouseMode()
}

function insidePoly(pt, poly) {
    var numIntersections = 0
    for (const seg of lineSegments(poly)) {
        // Does a ray going due +X from the point intersect the segment?
        const [m, b] = slope(seg)
        const y = pt.y
        var intercepts = false

        if (seg[0].y > y && seg[1].y > y) intercepts = false
        else if (seg[0].y < y && seg[1].y < y) intercepts = false
        else if (Number.isFinite(m)) {
            if (m == 0) intercepts = false // Ignore horizontal case
            else {
                const x = (y - b)/m
                intercepts = x > pt.x
            }
        } else if (Number.isNaN(m)) 
            intercepts = false // This is a dumb case, ignore it
        // seg goes up and down
        else 
            intercepts = seg[0].x > pt.x

        if (intercepts) numIntersections++
    }

    const ret = numIntersections % 2 == 1
    if (!ret) {
        console.log("Out of bounds", pt, poly)
        debugger;
    }
    return ret
}

const topQueue = []
function displayTop() {
    if (topQueue.length > 5) return
    else if (topQueue.length == 0) {
        topQueue.push(null)
        _displayTop.apply(null, arguments)
    } else topQueue.push(arguments)
}
setInterval(() => {
    if (topQueue.length == 0) return
    const next = topQueue.shift()
    if (next) _displayTop.apply(null, next)
}, 1000)
function _displayTop(msg, color) {
    // Display a message at the top of the screen, which automatically fades and deletes itself later, while drifting up
    const e = $(`<div class="topMessage">${msg}</div>`)
    if (color) e.css({"color": color})
    $("#playarea").append(e)
    setTimeout(() => e.remove(), 4000)
}

function displayBall(ball, msg, color) {
    // Display a little message of the ball, which automatically fades and deletes itself later, while drifting up.
    const e = $(`<div class="ballMessage">${msg}</div>`)
    if (color) e.css({"color": color})
    const ballPos = toPx(ball.pt)
    e.css({
        left: `${ballPos[0]}px`,
        top: `${ballPos[1]}px`,
    })
    $("#playarea").append(e)
    setTimeout(() => e.remove(), 4000)
}

function respawnBall(ball) {
    if (!ball) {
        ball = { combo: 1 }
        state.balls.push(ball)
        state.numbers.numBallsCurrent = state.balls.length
    }

    // TODO: Randomize the starting position a bit
    ball.pt = {...state.level.start}
    ball.vel = {x:0, y:0}
    ball.numPutts = 0
}
function bumpJackpot(ball) {
    if (state.numbers.jackpotEnabled) {
        const bump = state.numbers.jackpotRate * state.numbers.globalMult
        state.numbers.jackpot += bump
        displayBall(ball, `+$${bump} jackpot`, "gold")
    }
}
function ballSunk(ball) {
    var gain = state.numbers.holePayout * state.numbers.globalMult
    if (ball.numPutts == 1) { // Hole-in-one
        gain *= 2
        if (ball.numPutts == 1 && state.numbers.jackpot) { // Hole-in-one
            gain += state.numbers.jackpot
            state.numbers.jackpot = state.numbers.jackpotMinimum
            displayTop(`Jackpot! +$${gain}`, "gold")
        } else {
            displayTop(`Hole-in-one! +$${gain}`, "green")
        }
    } else {
        displayTop(`Hole Complete +$${gain}`, "green")
    }
    state.numbers.money += gain

    bumpJackpot(ball)

    if (ball.numPutts == 1 && state.numbers.jackpot) { // Hole-in-one
        const payout = state.numbers.jackpot
        displayTop(`Jackpot! +$${payout}`, "gold")
        state.numbers.money += payout
    }

    // idea: Make respawning take a while
    respawnBall(ball) 

    if (state.numbers.comboEnabled) {
        ball.combo = ball.combo + state.numbers.comboIncreasePerSink
        displayBall(ball, `x${ball.combo} combo`, "blue")
    }

    updateMouseMode()
}
function ballStopped(ball) {
    bumpJackpot(ball)

    if (state.numbers.comboEnabled) {
        const oldCombo = ball.combo
        ball.combo = Math.max(1, ball.combo - state.numbers.comboReductionPerPutt)

        if (ball.combo != oldCombo) {
            displayBall(ball, `x${ball.combo} combo`, "blue")
        }
    }
}

function updatePurchaseable() {
    for (const [k, v] of Object.entries(state.upgrades)) {
        var details = ""
        var avail = false
        const button = $(`button[for=${k}]`)
        
        if (v.length == 0) { // Sold out
            details = `(MAX)`
            button.attr("disabled", '')
        } else {
            const [cost, next] = v[0]
            const curr = state.numbers[k]
            details = `($${cost}, ${curr} -> ${next})`

            if (next == true) details = `($${cost})` // Enable flag

            avail = state.numbers.money >= cost
        }

        button.toggleClass("disabled", !avail)
        button.find(".details").text(details)
    }
}

function updateRequired() {
    for (const [k, v] of Object.entries(state.numbers)) {
        if (v == false || v == true) {
            $(`[requires=${k}]`).toggle(v)
        }
    }
}

function redraw() {
    const ctx = canvas.getContext("2d")

    function drawPoly(poly) {
        ctx.moveTo(...toPx(poly[0]))
        for (const pt of poly.slice(1)) {
            ctx.lineTo(...toPx(pt))
        }
        ctx.lineTo(...toPx(poly[1])) // Round that last corner
    }
    function drawCircle(center, rad, color) {
        ctx.beginPath()
        ctx.fillStyle = color
        ctx.arc(...toPx(center), rad, 0, 2*Math.PI)
        ctx.fill()
    }

    // Draw brown background
    ctx.fillStyle = "#b5815a"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw green
    ctx.beginPath()
    ctx.strokeStyle = "#5e2c06"
    ctx.lineWidth = 10
    drawPoly(state.level.border)
    ctx.stroke()

    ctx.beginPath()
    ctx.fillStyle = "#117c13"
    drawPoly(state.level.border)
    ctx.fill()

    // Draw the mouse preview
    if (state.mouse.held && state.mouse.mode == "plan") {
        const ball = state.manualBall

        ctx.save()
        ctx.strokeStyle = "rgba(0, 0, 0, 0.6)"
        ctx.setLineDash([10, 20])
        ctx.lineWidth = 5
        const elapsed = (new Date() - state.mouse.holdStartTs)/1000
        ctx.lineDashOffset = (-elapsed * 100) % 30

        ctx.beginPath()
        ctx.moveTo(...toPx(ball.pt))
        // Find the mirror fo the mouse
        const target = mirror(state.mouse.pt, ball.pt)
        const move = sub(target, ball.pt)
        const newTarget = add(ball.pt, limitMag(move, state.numbers.manualPuttMax))
        ctx.lineTo(...toPx(newTarget))
        ctx.stroke()
        ctx.restore()

        drawCircle(state.mouse.pt, 0.2*units, "red")
    } else if (state.mouse.mode == "plan") {
        // Visual cue that you're in putt mode
        drawCircle(state.mouse.pt, 0.2*units, "rgba(255, 0, 0, 0.5)")
    }

    // Draw the hole
    drawCircle(state.level.hole, 0.2*units, "black")

    // Draw a ring around the manually active ball
    if (state.numbers.numBallsMax > 1 && state.manualBall && mag(state.manualBall.vel) == 0) {
        drawCircle(state.manualBall.pt, 0.2*units, "rgba(255, 122, 122, 0.8)")
    }

    // Draw the balls
    for (const ball of state.balls) {
        drawCircle(ball.pt, 0.1*units, "white")
    }

    if (state.numbers.won) {
        text = `You win!`
        ctx.font = "50px Arial";
        const size = ctx.measureText(text)
        size.height = 50

        ctx.fillStyle="#9daeb2"
        const x1 = canvas.width/2-size.width/2
        const y1 = canvas.height/2-size.height/2
        ctx.fillRect(x1-20, y1-20, size.width+40, size.height+40)

        ctx.fillStyle="black"
        ctx.textBaseline = "top"
        //ctx.fillText(text, canvas.width/2-size.width/2, canvas.height/2-size.width/2)
        ctx.fillText(text, x1, y1+3)
    }

    // Draw the stats
    for (const number in state.numbers) {
        $(`.${number}`).text(state.numbers[number])
    }

    updatePurchaseable()
}

respawnBall(null)
$(window).on("resize", resizeCanvas); resizeCanvas()
$(canvas).on("mousedown mouseup mousemove touchstart touchmove touchend touchcancel", mouse)
const tickInterval = setInterval(tick, 10)
updateRequired()

$("button").on("click", (e) => {
    const for_ = $(e.currentTarget).attr("for")
    const desc = $(e.currentTarget).find(".desc").text()
    const upgrades = state.upgrades[for_] || []

    if (upgrades.length == 0) {
        displayTop(`'${desc}' sold out`, "red")
        return
    }

    // Check current purchase price of the button
    const price = upgrades[0][0]
    if (false && price > state.numbers.money) {
        displayTop(`Not enough money`, "red")
        return
    }

    // Do purchase
    state.numbers.money -= price
    displayTop(`Purchased for $${price}: ${desc}`, "green")

    state.numbers[for_] = upgrades[0][1]
    state.numbers.jackpot = Math.max(state.numbers.jackpot, state.numbers.jackpotMinimum)
    while (state.numbers.numBallsMax > state.numbers.numBallsCurrent) respawnBall(null)

    upgrades.splice(0, 1)

    updateRequired()
})
