const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const app = express();
const port = process.env.PORT || 12002;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cookieParser = require("cookie-parser");
require("dotenv").config();


// Middleware
app.use(
  cors({
    origin: [
      "https://restaurent-managment-client.netlify.app",
      "http://localhost:5173",
      "http://localhost:5174",
    ],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_NAME}:${process.env.DB_PASSWORD}@cluster0.dn60035.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// middlewares
const logger = async (req, res, next) => {
  console.log("called", req.host, req.originalUrl);
  next();
};

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.accessToken;
  console.log("Value of token in middleware", token);
  if (!token) {
    return res.status(401).send({ message: "Forbidden" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    // error
    if (err) {
      console.log("jwt.verify", err);
      return res.status(401).send({ message: "Unauthorized it" });
    }
    // if token is valid then it would be decoded
    console.log("value in the token", decoded);
    req.user = decoded;
    next();
  });
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const database = client.db("insertDB");
    const usersCollection = database.collection("users");
    const allFoodCollection = database.collection("allFood");
    const orderFoodCollection = database.collection("orderFood");

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );

    // Auth related Api
    app.post("/jwt", logger, async (req, res) => {
      const user = req.body;
      // console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res
        .cookie("accessToken", token, {
          // httpOnly: true,
          // secure: false,
          // sameSite: "none",
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // server related Api
    app.post("/users", async (req, res) => {
      const user = req.body;
      console.log("new user", user);
      const result = await usersCollection.insertOne(user);
      // console.log(result);
      res.send(result);
    });

    app.get("/users", async (req, res) => {
      const cursor = usersCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post("/all-food", async (req, res) => {
      const addedFood = req.body;
      // console.log("new added Food", addedFood);
      const result = await allFoodCollection.insertOne(addedFood);
      // console.log(result);
      res.send(result);
    });

    app.get("/all-food", async (req, res) => {
      console.log(req.query);
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      // console.log("pagination", page, size);
      const cursor = allFoodCollection
        .find()
        .skip(page * size)
        .limit(size);
      const result = await cursor.toArray();
      // console.log(result);
      res.send(result);
    });
    app.get("/all-food-count", async (req, res) => {
      const count = await allFoodCollection.estimatedDocumentCount();
      res.send({ count });
    });

    app.get("/all-food/id/:id", logger, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await allFoodCollection.findOne(query);
      res.send(result);
    });

    app.get("/my-added-food", logger, verifyToken, async (req, res) => {
      console.log(req.query.userEmail);
      // console.log("ttttt token", req.cookies.accessToken);
      console.log("user in the valid token", req.user);
      if (req.query.userEmail !== req.user.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      let query = {};
      if (req.query?.userEmail) {
        query = { userEmail: req.query?.userEmail };
      }
      const cursor = allFoodCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.put("/all-food/id/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedFood = req.body;
      const product = {
        $set: {
          food_image: updatedFood.food_image,
          food_name: updatedFood.food_name,
          food_origin: updatedFood.food_origin,
          food_category: updatedFood.food_category,
          price: updatedFood.price,
          description: updatedFood.description,
          made_by: updatedFood.made_by,
          add_by: updatedFood.add_by,
          quantity: updatedFood.quantity,
        },
      };
      const result = await allFoodCollection.updateOne(
        filter,
        product,
        options
      );
      res.send(result);
      // console.log(updatedFood);
    });

    app.put("/all-food-purchase/id/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updatedFood = req.body;
      const product = {
        $set: {
          quantity: updatedFood.quantity,
          sold: updatedFood.sold,
        },
      };
      const result = await allFoodCollection.updateOne(
        filter,
        product,
        options
      );
      res.send(result);
      // console.log(updatedFood);
    });

    app.put("/all-food-purchase-cancel/id/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      // const options = { upsert: true };
      const updatedFood = req.body;
      const product = {
        $set: {
          quantity: updatedFood.quantity,
        },
      };
      const result = await allFoodCollection.updateOne(
        filter,
        product
        // options
      );
      res.send(result);
      // console.log(updatedFood);
    });

    app.post("/order-food", async (req, res) => {
      const orderFood = req.body;
      // console.log(orderFood);
      const result = await orderFoodCollection.insertOne(orderFood);
      res.send(result);
    });

    app.get("/order-food", logger, verifyToken, async (req, res) => {
      console.log(req.query.userEmail);

      console.log("user in the valid token", req.user);
      if (req.query.userEmail !== req.user.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      let query = {};
      if (req.query?.userEmail) {
        query = { userEmail: req.query?.userEmail };
      }
      const cursor = orderFoodCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/Order-food/details/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await orderFoodCollection.findOne(query);
      res.send(result);
    });

    app.delete("/order-food/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await orderFoodCollection.deleteOne(query);
      res.send(result);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Restaurant server data");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

/**
 * echo "# b8a11-server-side-tayeb012" >> README.md
  git init
  git add README.md
  git commit -m "first commit"
  git branch -M main
  git remote add origin https://github.com/Porgramming-Hero-web-course/b8a11-server-side-tayeb012.git
  git push -u origin main
 */
