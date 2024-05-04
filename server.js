const express = require("express");
const mysql = require("mysql");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");

const app = express();
const port = 3000;
const cors = require("cors");
const secretKey = "my_secret_key";

// MySQL Connection
const connection = mysql.createConnection({
  host: "sql5.freemysqlhosting.net",
  user: "sql5702937",
  password: "Us3t8X7RiN",
  database: "sql5702937",
});

connection.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL: " + err.stack);
    return;
  }
  console.log("Connected to MySQL as id " + connection.threadId);
});

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Generate JWT token
function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, secretKey, {
    expiresIn: "1m",
  });
}

// Register User
app.post("/api/signup", (req, res) => {
  const { email, password, name } = req.body;
  const newUser = { email, password, name };
  connection.query(
    "INSERT INTO users SET ?",
    newUser,
    (error, results, fields) => {
      if (error) throw error;
      res
        .status(201)
        .json({ success: true, message: "User registered successfully" });
    }
  );
});

// Login User
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  connection.query(
    "SELECT * FROM users WHERE email = ? AND password = ?",
    [email, password],
    (error, results, fields) => {
      if (error) throw error;
      if (results.length > 0) {
        const token = generateToken(results[0]);
        res
          .status(200)
          .json({ success: true, message: "Login successful", token });
      } else {
        res
          .status(401)
          .json({ success: false, message: "Invalid credentials" });
      }
    }
  );
});

// Middleware to validate JWT token
function verifyToken(req, res, next) {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }
  jwt.verify(token, secretKey, (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: "Failed to authenticate token" });
    }

    // Store decoded user information for further use in the request
    req.user = decoded;
    next();
  });
}

// Protect routes with JWT authentication
app.use("/api", verifyToken);

// Add New Budget
app.post("/api/addBudget", (req, res) => {
  const { amount, category } = req.body;
  const userId = req.user.id;
  const newBudget = { user_id: userId, amount, category };
  connection.query(
    "INSERT INTO budgets SET ?",
    newBudget,
    (error, results, fields) => {
      if (error) throw error;
      res.status(201).json({ message: "Budget added successfully" });
    }
  );
});

app.post("/api/addExpense", (req, res) => {
  const { amount, category } = req.body;
  const userId = req.user.id;

  const sqlQuery = `
    INSERT INTO expenses (user_id, amount, category)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE
      amount = VALUES(amount),
      category = VALUES(category)
  `;

  connection.query(
    sqlQuery,
    [userId, amount, category],
    (error, results, fields) => {
      if (error) throw error;
      res.status(201).json({ message: "Expense added successfully" });
    }
  );
});

// Update Budget
app.put("/api/budgets/:id", (req, res) => {
  const { id } = req.params;
  const { amount, category } = req.body;

  connection.query(
    "UPDATE budgets SET amount = ?, category = ? WHERE id = ?",
    [amount, category, id],
    (error, results, fields) => {
      if (error) {
        return res.status(500).json({ message: "Failed to update budget" });
      }
      if (results.affectedRows === 0) {
        return res
          .status(404)
          .json({ message: "Budget not found or unauthorized" });
      }
      res.status(200).json({ message: "Budget updated successfully" });
    }
  );
});

// Delete Budget
app.delete("/api/budgets/:id", (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  connection.query(
    "DELETE FROM budgets WHERE id = ? AND user_id = ?",
    [id, userId],
    (error, results, fields) => {
      if (error) {
        return res.status(500).json({ message: "Failed to delete budget" });
      }
      if (results.affectedRows === 0) {
        return res
          .status(404)
          .json({ message: "Budget not found or unauthorized" });
      }
      res.status(200).json({ message: "Budget deleted successfully" });
    }
  );
});

// Fetch All Expenses for a User
app.get("/api/expenses", (req, res) => {
  const userId = req.user.id;
  connection.query(
    "SELECT * FROM expenses WHERE user_id = ?",
    userId,
    (error, results, fields) => {
      if (error) throw error;
      res.status(200).json(results);
    }
  );
});

// Fetch All Budgets for a User
app.get("/api/budgets", (req, res) => {
  const userId = req.user.id;
  connection.query(
    "SELECT * FROM budgets WHERE user_id = ?",
    userId,
    (error, results, fields) => {
      if (error) throw error;
      res.status(200).json(results);
    }
  );
});

//Get the refresh token
app.get("/api/refresh-token", (req, res) => {
  const user = req.user;
  if (!user) return res.sendStatus(403);
  try {
    const token = generateToken(user);
    res.json({ token });
  } catch (err) {
    // If token is expired or invalid, return error
    return res.sendStatus(403);
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
