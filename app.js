var app = require('express')();
var http = require('https').createServer(app);
var io = require('socket.io')(http);
var admin = require("firebase-admin");

var serviceAccount = require("./firebase.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://do-you-know-the-answer-3844138.firebaseio.com"
});

var db = admin.firestore();

app.get('/', (req, res) => {
  res.send("Hello\n<script src='/socket.io/socket.io.js'></script>")
});

io.on('connection', async (socket) => {
  console.log('a user connected');
  socket.on('get', async () => {
    socket.emit('getQues', await getQuestions());
  })

  socket.on('joinRoom', async () => {
    var rooms = await getRoom()
    var gameId;
    var hostedRoom = false;
    rooms.forEach(async (data) => {
      if (data.otaq.current < data.otaq.max) {
        hostedRoom = true
        gameId = data.id
        joinRoom(data.id, data.otaq.player1 == "" ? {
          current: 1,
          player1: socket.id
        } : {
          current: 2,
          player2: socket.id
        })
        socket.emit("sendRoom", await get_a_room(gameId))

        isStart(gameId).then(async (starting) => {
          if (starting) {
            for (let index = 0; index < starting.length; index++) {
              io.to(starting[index]).emit("startGame", await questionGenerator())
            }
          }
        })
        return
      }
    })

    if (hostedRoom == false) {
      createRoom().then((ref) => {
        joinRoom(ref.id, {
          player1: socket.id,
          current: 1
        })
        gameId = ref.id
        socket.emit("sendRoom", {
          id: gameId,
          otaq: {
            current: 1,
            max: 2,
            player1: socket.id,
            player2: ""
          }
        })
      })
    }

  })

  socket.on('sendResult', async (user) => {
    io.to(user.rivalId).emit("result", user.answer);
  });

  socket.on('exitRoom', async (room) => {
    console.log(room)
    joinRoom(room.id, room.otaq.player1 == socket.id ? {
      current: room.otaq.current - 1,
      player1: ""
    } : {
      current: room.otaq.current - 1,
      player2: ""
    })
  })



  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
});

http.listen(3000, () => {
  console.log('listening on *:3000');
});


async function getQuestions() {
  var suallar = []
  await db.collection('Suallar').get()
    .then((snapshot) => {
      snapshot.forEach((doc) => {
        suallar.push(doc.data())
      });
    })
    .catch((err) => {
      console.log('Error getting documents', err);
    })

  return suallar
}

async function getRoom() {
  var Otaqlar = []
  await db.collection('Otaqlar').get()
    .then((snapshot) => {
      snapshot.forEach((doc) => {
        Otaqlar.push({
          id: doc.id,
          otaq: doc.data()
        })
      });
    })
    .catch((err) => {
      console.log('Error getting documents', err);
    })

  return Otaqlar
}

async function createRoom() {
  var id;
  let a = await db.collection('Otaqlar').add({
    current: 0,
    max: 2,
    player1: "",
    player2: ""
  })
  id = a.id;
  return {
    id: id,
    otaq: {
      current: 0,
      max: 2,
      player1: "",
      player2: ""
    }
  }
}

function joinRoom(doc, obj) {
  let Up = db.collection("Otaqlar").doc(doc);
  Up.update(obj)
}

async function get_a_room(doc) {
  var g = await db.collection("Otaqlar").doc(doc).get()
  return {
    id: g.id,
    otaq: g.data()
  }
}


async function isStart(ref) {
  let players = []
  let form = await db.collection("Otaqlar").doc(ref).get()
  if (form.data().current == form.data().max) {
    for (let index = form.data().max; index > 0; index--) {
      players.push(form.data()["player" + index]);
    }
  }
  console.log(players)
  return players.length > 0 ? players : false
}


async function questionGenerator() {
  var ques = await getQuestions()
  var randomQuestoins = getRandom(ques, 10)
  return {
    first: randomQuestoins.slice(0, (randomQuestoins.length / 2)),
    second: randomQuestoins.slice((randomQuestoins.length / 2), randomQuestoins.length)
  }
}

function getRandom(arr, n) {
  var result = new Array(n),
    len = arr.length,
    taken = new Array(len);
  if (n > len)
    throw new RangeError("getRandom: more elements taken than available");
  while (n--) {
    var x = Math.floor(Math.random() * len);
    result[n] = arr[x in taken ? taken[x] : x];
    taken[x] = --len in taken ? taken[len] : len;
  }
  return result;
}