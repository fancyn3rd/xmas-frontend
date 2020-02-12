import intersects from "intersects"
import mqtt from "mqtt"
import * as PIXI from "pixi.js"

const DEBUG = false
const TESTMODE = true

const MAX_BALLS = 100
const MAX_TEXTURES = 8

const mqttClient = mqtt.connect("mqtt://localhost:9001")

const app = new PIXI.Application({ backgroundColor: 0x00000, antialias: true, width: screen.width, height: screen.height});
document.body.appendChild(app.view)

const tanne = PIXI.Sprite.from('assets/tanne.png');
app.stage.addChild(tanne);

const spawnArea = new PIXI.Graphics();
const spawnAreaPath1 = [250, 630, 1030, 630, 671, 50];
const spawnAreaPath2 = [230, 490, 1070, 490, 671, 200];
const spawnAreaPath3 = [390, 308, 910, 308, 671, 50];

const ornamentStyle = new PIXI.TextStyle({
  fontFamily: 'Times',
  fontSize: 28,
  fontStyle: 'italic',
  fill: ['#cc0000', '#440a0a'],
  dropShadow: true,
  dropShadowColor: '#000000',
  dropShadowBlur: 4,
  dropShadowAngle: Math.PI / 6,
  dropShadowDistance: 2,

});

let balls = [MAX_BALLS]
let ornaments = [MAX_BALLS]

const ballTextures = []

let initialBallCount = false;



/* ******************************************************************************** */

/* SETUP */

initBalls()
setupSpawnArea()
loadTextures()

/* */

if (TESTMODE) {

  for (let i = 1; i < 10; i++) {
    spawnBall()
  }

  setInterval(() => spawnBall(), 5000)
  setInterval(() => removeBall(), 7000)
}

setInterval(() => updateBallLifeTime(), 1000)




/* LOOP */

app.ticker.add(() => {
  for (let i=0; i < balls.length; i++) {
    if(balls[i].radius > 0) {

      if (balls[i].radius < balls[i].maxRadius && !balls[i].shrink) {
        balls[i].radius +=0.5
      } else if (!balls[i].grown && !balls[i].shrink) {
        console.info("Grown ball", i)
        balls[i].grown = true
        drawOrnament(i)
      }

      

      if (balls[i].shrink && balls[i].radius > 0) {
        balls[i].radius -=0.5
        delteOrnament(i)
        balls[i].grown = false


        if (balls[i].radius <= 0) {
            console.info("Reset ball", i)
            balls[i].instanced = false
        }
      }
        drawBall(i)
    } 
  }
})



/* ******************************************************************************** */

function initBalls() {

  for (let i=0 ; i< MAX_BALLS; i++) {
    const newBall = new PIXI.Graphics()
    balls[i] = newBall
    balls[i].instanced = false
    app.stage.addChild(balls[i])

    const newOrnament = new PIXI.Text('8', ornamentStyle);
    ornaments[i] = newOrnament
  }
}

function loadTextures() {
  for (let i = 1; i <= MAX_TEXTURES; i++) {
      ballTextures[i] = PIXI.Texture.from(`assets/pattern/0${i}.png`);
    }
  }

function setupSpawnArea() {
  spawnArea.beginFill(0x3500FA, DEBUG)
  spawnArea.drawPolygon(spawnAreaPath1)
  spawnArea.drawPolygon(spawnAreaPath2)
  spawnArea.drawPolygon(spawnAreaPath3)
  spawnArea.endFill()
  app.stage.addChild(spawnArea)
}

function spawnBall() {
  const currentBallId = balls.findIndex(ball => !ball.instanced)
  createBall(currentBallId)

  if (isBallInSpawnArea(currentBallId)) {
    balls[currentBallId].instanced = true
  } else {
    spawnBall()
  }
}

function isBallInSpawnArea(id) {
  return (
    (intersects.circlePolygon(balls[id].posX, balls[id].posY, balls[id].radius, spawnAreaPath1)) ||
    (intersects.circlePolygon(balls[id].posX, balls[id].posY, balls[id].radius, spawnAreaPath2)) ||
    (intersects.circlePolygon(balls[id].posX, balls[id].posY, balls[id].radius, spawnAreaPath3)) 
  )
}

function removeBall() {
    const longestLifeTime = balls.indexOf(balls.reduce((prev, next) => {
      return next.lifeTime > prev.lifeTime ? next : prev
    }))
      balls[longestLifeTime].shrink = true
}

function createBall(id) {
  balls[id].id = id
  balls[id].posX = randomRange(119,1164)
  balls[id].posY = randomRange(8,678)
  balls[id].radius = 0.1
  balls[id].maxRadius = randomRange(17,27)
  balls[id].instanced = false
  balls[id].shrink = false
  balls[id].lifeTime = 0
  balls[id].textureId = randomRange(1,MAX_TEXTURES)
}


function drawBall(id) {
  balls[id].clear();

  //draw shadow
  balls[id].beginFill(123, 1);
  balls[id].beginFill("#000000", 0.4)
  balls[id].drawCircle(balls[id].posX+3, balls[id].posY+3, balls[id].radius);
  balls[id].endFill();

  //draw ball
  balls[id].beginFill(123, 1);
  balls[id].lineStyle(0,0x004600);
  balls[id].beginTextureFill(ballTextures[balls[id].textureId]);
  balls[id].drawCircle(balls[id].posX, balls[id].posY, balls[id].radius);
  balls[id].endFill();
}

function drawOrnament(id) {
  ornaments[id].anchor.set(0.5);
  ornaments[id].rotation = randomRange(40,70)
  ornaments[id].x = balls[id].posX;
  ornaments[id].y = balls[id].posY - balls[id].maxRadius;
  app.stage.addChild(ornaments[id]);
}

function delteOrnament(id) {
  app.stage.removeChild(ornaments[id]);
}


function updateBallLifeTime() {
  for (let i=0; i<balls.length; i++) {
    if (balls[i] && !balls[i].shrink) {
      balls[i].lifeTime++
    } else {
      balls[i].lifeTime = 0
    }
  }
}


mqttClient.on("connect", function () {
  mqttClient.subscribe("addBall")
  mqttClient.subscribe("removeBall")
  mqttClient.subscribe("deviceCount")
})

mqttClient.on("message", function (topic, payload) {

  if (topic === "deviceCount" && !initialBallCount) {
    const deviceCount = parseInt(payload)
    console.log("Initial Devices: " + deviceCount)
    for (let i=0; i<deviceCount; i++) {
      spawnBall()
     }
     initialBallCount = true
  }

  if (topic === "addBall" && balls.length < MAX_BALLS + 1) {
    console.log("EVENT", topic)
    spawnBall()
  }
  if (topic === "removeBall") {
    console.log("EVENT", topic)
    removeBall()
  }
})


function randomRange(min, max) {
  return Math.floor(Math.random() * (max - 1 - min + 1) + min)
}

  
