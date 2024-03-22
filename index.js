const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

// MongoDB Connection URL
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function run() {
  try {
    // Connect to MongoDB
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db("FoodSphere");
    const collection = db.collection("users");
    const supplyCollection = db.collection("supplyCollection");
    const volunteerCollection = db.collection("volunteer");
    const commentCollection = db.collection("comment");
    const donorTestimonialsCollection = db.collection("testimonials");

    // User Registration
    app.post("/api/v1/register", async (req, res) => {
      const { name, email, password } = req.body;

      // Check if email already exists
      const existingUser = await collection.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "User already exists",
        });
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert user into the database
      await collection.insertOne({ name, email, password: hashedPassword });

      res.status(201).json({
        success: true,
        message: "User registered successfully",
      });
    });

    // User Login
    app.post("/api/v1/login", async (req, res) => {
      const { email, password } = req.body;

      // Find user by email
      const user = await collection.findOne({ email });
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Compare hashed password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Generate JWT token
      const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, {
        expiresIn: process.env.EXPIRES_IN,
      });

      res.json({
        success: true,
        message: "Login successful",
        token,
      });
    });

    //get all users
    app.get("/users", async (req, res) => {
      const result = await collection.find().toArray();
      res.send(result);
    });

    //get single user

    // ==============================================================
    // WRITE YOUR CODE HERE
    //post supply item
    app.post("/create-supply", async (req, res) => {
      const addSupplyItem = req.body;
      const result = await supplyCollection.insertOne(addSupplyItem);
      res.send(result);
    });

    //get all supply item
    app.get("/supplies", async (req, res) => {
      const result = await supplyCollection.find().toArray();
      res.send(result);
    });

    //get single supply item by id
    app.get("/supplies/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await supplyCollection.findOne(query);
      res.send(result);
    });

    //delete an supply item
    app.delete("/supplies/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await supplyCollection.deleteOne(query);
      res.send(result);
    });

    //update an supply item
    app.put("/supplies/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateSupply = req.body;
      const supplyData = {
        $set: {
          image: updateSupply.image,
          category: updateSupply.category,
          title: updateSupply.title,
          quantity: updateSupply.quantity,
          description: updateSupply.description,
        },
      };
      const result = await supplyCollection.updateOne(
        filter,
        supplyData,
        options
      );
      res.send(result);
    });

    // post volunteer
    app.post("/volunteer", async (req, res) => {
      const addVolunteer = req.body;
      const result = await volunteerCollection.insertOne(addVolunteer);
      res.send(result);
    });

    // get volunteer
    app.get("/volunteer", async (req, res) => {
      const result = await volunteerCollection.find().toArray();
      res.send(result);
    });

    // post comment
    app.post("/comment", async (req, res) => {
      const addComment = req.body;
      addComment.Date = new Date();
      const result = await commentCollection.insertOne(addComment);
      res.send(result);
    });

    // get comment
    app.get("/comment", async (req, res) => {
      const result = await commentCollection.find().toArray();
      res.send(result);
    });

    // testimonials
    app.post("/create-testimonial", async (req, res) => {
      const addTestimonials = req.body;
      const result = await donorTestimonialsCollection.insertOne(
        addTestimonials
      );
      res.send(result);
    });

    // get testimonials
    app.get("/testimonials", async (req, res) => {
      const result = await donorTestimonialsCollection.find().toArray();
      res.send(result);
    });

    // get
    app.get("/all-stats", async (req, res) => {
      const totalUsers = await collection.estimatedDocumentCount();
      const totalSupply = await supplyCollection.estimatedDocumentCount();
      const categories = await supplyCollection.distinct("category");
      const totalCategories = categories.length;
      res.send({
        totalUsers,
        totalSupply,
        categories,
        totalCategories,
      });
    });
    ////////////////////////
    app.get("/total-categories", async (req, res) => {
      try {
        const categories = await supplyCollection.distinct("category");
        const totalCategories = categories.length;

        res.json({ totalCategories });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    ///////////////
    app.get("/categoryCounts", async (req, res) => {
      try {
        const categoryCounts = await supplyCollection
          .aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }])
          .toArray();

        res.json(categoryCounts);
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    ////////////
    app.get("/total-quantity-by-user", async (req, res) => {
      try {
        const totalQuantityByUser = await db
          .collection("supplyCollection")
          .aggregate([
            {
              $group: {
                _id: "$user",
                totalQuantity: { $sum: { $toInt: "$quantity" } },
              },
            },
            {
              $project: {
                _id: 0,
                username: "$_id",
                totalQuantity: 1,
              },
            },
          ])
          .toArray();

        res.json(totalQuantityByUser);
      } catch (err) {
        console.error("Error fetching total quantity by user:", err);
        res
          .status(500)
          .json({ error: "Failed to fetch total quantity by user" });
      }
    });

    // ==============================================================

    // Start the server
    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
    });
  } finally {
  }
}

run().catch(console.dir);

// Test route
app.get("/", (req, res) => {
  const serverStatus = {
    message: "Server is running smoothly",
    timestamp: new Date(),
  };
  res.json(serverStatus);
});
