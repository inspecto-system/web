import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthForm } from "@/auth/auth-form";
import { setAccessToken } from "@/auth/session";
import { useSession } from "@/auth/session-provider";
import { fakeApi, json, problem, renderApp, tokens, user, type Routes } from "@/testing/render";

function Status() {
  const { status, user: current } = useSession();
  return <p data-testid="status">{`${status}:${current?.fullName ?? ""}`}</p>;
}

const signedOut: Routes = { "POST /auth/refresh": () => problem(401, "UNAUTHENTICATED") };

async function fillLogin(email: string, password: string) {
  await userEvent.type(await screen.findByLabelText("Email"), email);
  await userEvent.type(screen.getByLabelText("Пароль"), password);
  await userEvent.click(screen.getByRole("button", { name: "Войти" }));
}

beforeEach(() => setAccessToken(null));
afterEach(() => vi.unstubAllGlobals());

describe("AuthForm", () => {
  it("signs in as a web client and loads the profile", async () => {
    const { requests } = fakeApi({
      ...signedOut,
      "POST /auth/login": () => json(200, tokens),
      "GET /users/me": (request) =>
        request.headers.get("Authorization") === "Bearer access-1"
          ? json(200, user)
          : problem(401, "UNAUTHENTICATED"),
    });
    renderApp(
      <>
        <AuthForm mode="login" />
        <Status />
      </>,
    );
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("signedOut"));

    await fillLogin(" anna@example.com ", "Kitchen-Window-Crack-42");

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("signedIn:Анна Инспектор"));
    const login = requests.find((request) => request.url.endsWith("/auth/login"));
    expect(await login?.json()).toEqual({
      email: "anna@example.com",
      password: "Kitchen-Window-Crack-42",
      client: "web",
    });
  });

  it("explains wrong credentials and a lock", async () => {
    let attempt = 0;
    fakeApi({
      ...signedOut,
      "POST /auth/login": () =>
        ++attempt === 1 ? problem(401, "INVALID_CREDENTIALS") : problem(423, "ACCOUNT_LOCKED"),
    });
    renderApp(<AuthForm mode="login" />);

    await fillLogin("anna@example.com", "wrong-password");
    expect(await screen.findByText("Неверный email или пароль")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Войти" }));
    expect(await screen.findByText(/Слишком много неудачных попыток/)).toBeInTheDocument();
  });

  it("registers and signs in; a short password is refused before any request", async () => {
    const { requests } = fakeApi({
      ...signedOut,
      "POST /auth/register": () => json(201, user),
      "POST /auth/login": () => json(200, tokens),
      "GET /users/me": () => json(200, user),
    });
    renderApp(
      <>
        <AuthForm mode="register" />
        <Status />
      </>,
    );
    await userEvent.type(await screen.findByLabelText("Имя и фамилия"), "Анна Инспектор");
    await userEvent.type(screen.getByLabelText("Email"), "anna@example.com");
    await userEvent.type(screen.getByLabelText("Пароль"), "short");
    await userEvent.click(screen.getByRole("button", { name: "Зарегистрироваться" }));
    expect(await screen.findByText("Пароль должен быть не короче 10 символов")).toBeInTheDocument();
    expect(requests.some((request) => request.url.endsWith("/auth/register"))).toBe(false);

    await userEvent.type(screen.getByLabelText("Пароль"), "-Window-Crack-42");
    await userEvent.click(screen.getByRole("button", { name: "Зарегистрироваться" }));

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("signedIn"));
    const register = requests.find((request) => request.url.endsWith("/auth/register"));
    expect(await register?.json()).toEqual({
      fullName: "Анна Инспектор",
      email: "anna@example.com",
      password: "short-Window-Crack-42",
    });
  });

  it("shows why the server refused a registration", async () => {
    fakeApi({
      ...signedOut,
      "POST /auth/register": () =>
        problem(400, "VALIDATION_ERROR", [{ field: "password", code: "WEAK_PASSWORD" }]),
    });
    renderApp(<AuthForm mode="register" />);
    await userEvent.type(await screen.findByLabelText("Имя и фамилия"), "Анна");
    await userEvent.type(screen.getByLabelText("Email"), "anna@example.com");
    await userEvent.type(screen.getByLabelText("Пароль"), "anna@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Зарегистрироваться" }));

    expect(await screen.findByText("Пароль слишком простой или совпадает с email")).toBeInTheDocument();
  });
});
