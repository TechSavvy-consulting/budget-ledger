const form = document.querySelector("#loginForm");
const message = document.querySelector("#loginMessage");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "";

  const data = new FormData(form);
  const submit = form.querySelector("button[type='submit']");
  submit.disabled = true;

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: data.get("username"),
        password: data.get("password"),
      }),
    });

    if (response.ok) {
      window.location.assign("/");
      return;
    }

    const result = await response.json().catch(() => ({}));
    message.textContent = result.message || "Unable to sign in.";
  } catch {
    message.textContent = "Unable to reach the server.";
  } finally {
    submit.disabled = false;
  }
});
