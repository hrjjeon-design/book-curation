const API_URL = "http://localhost:3000/api/themes";

async function checkThemes() {
  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    console.log("Total themes returned:", data.length);
    if (data.length > 20) {
      console.log("ERROR: Returning more than 20 themes!");
    }
    const grouped = data.reduce((acc, t) => {
      acc[t.group] = (acc[t.group] || 0) + 1;
      return acc;
    }, {});
    console.log("Groups:", grouped);
  } catch (e) {
    console.log("Server not running or error:", e.message);
  }
}

checkThemes();
