import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setAccessToken } from "@/auth/session";
import { PhotoStrip } from "@/photos/photo-strip";
import { fakeApi, json, problem, renderApp, tokens, user, type Routes } from "@/testing/render";

const limits = {
  allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
  maxFileSizeBytes: 1024,
  maxPixels: 1_000_000,
  maxPhotosPerObservation: 2,
};
const session: Routes = {
  "POST /auth/refresh": () => json(200, tokens),
  "GET /users/me": () => json(200, user),
  "GET /photos/limits": () => json(200, limits),
  "GET /photos/p1/content": () => new Response(new Blob(["jpeg"]), { status: 200 }),
  "GET /photos/p2/content": () => new Response(new Blob(["jpeg"]), { status: 200 }),
};
const jpeg = (size = 10) => new File(["x".repeat(size)], "room.jpg", { type: "image/jpeg" });

beforeEach(() => {
  setAccessToken(null);
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:photo" }));
});
afterEach(() => vi.unstubAllGlobals());

describe("PhotoStrip", () => {
  it("uploads a file with an Idempotency-Key and attaches it to the observation", async () => {
    const changed = vi.fn();
    const { requests } = fakeApi({
      ...session,
      "POST /photos": () => json(201, { id: "p-new" }),
      "POST /observations/obs-1/photos": () => json(201, {}),
    });
    renderApp(
      <PhotoStrip propertyId="prop-1" observationId="obs-1" photoIds={[]} editable onChanged={changed} />,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Добавить фото" })).toBeEnabled());

    await userEvent.upload(screen.getByLabelText("Выбрать фото"), jpeg());

    await waitFor(() => expect(changed).toHaveBeenCalled());
    const upload = requests.find((r) => r.method === "POST" && r.url.endsWith("/photos"))!;
    expect(upload.headers.get("Idempotency-Key")).toMatch(/^[0-9a-f-]{36}$/);
    // Read as text: undici cannot parse a multipart body holding a jsdom File back into FormData.
    const multipart = await upload.text();
    expect(multipart).toMatch(/name="propertyId"\r\n\r\nprop-1/);
    // The file name is lost only in jsdom; a real browser upload is covered by e2e/live.spec.ts.
    expect(multipart).toContain('name="file"');
    const attach = requests.find((r) => r.url.endsWith("/observations/obs-1/photos"))!;
    expect(await attach.json()).toEqual({ photoId: "p-new" });
  });

  it("refuses a file over the limit or of another type before uploading", async () => {
    const { requests } = fakeApi(session);
    renderApp(
      <PhotoStrip propertyId="prop-1" observationId="obs-1" photoIds={[]} editable onChanged={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Добавить фото" })).toBeEnabled());

    await userEvent.upload(screen.getByLabelText("Выбрать фото"), jpeg(2048));
    expect(await screen.findByText("Файл больше 0 МБ")).toBeInTheDocument();
    await userEvent.upload(
      screen.getByLabelText("Выбрать фото"),
      new File(["%PDF"], "doc.pdf", { type: "application/pdf" }),
      { applyAccept: false },
    );
    expect(await screen.findByText("Нужен файл JPEG, PNG или WebP")).toBeInTheDocument();
    expect(requests.some((r) => r.method === "POST" && r.url.endsWith("/photos"))).toBe(false);
  });

  it("shows thumbnails, stops at the limit, previews and detaches a photo", async () => {
    const changed = vi.fn();
    const { requests } = fakeApi({
      ...session,
      "DELETE /observations/obs-1/photos/p1": () => new Response(null, { status: 204 }),
    });
    renderApp(
      <PhotoStrip
        propertyId="prop-1"
        observationId="obs-1"
        photoIds={["p1", "p2"]}
        editable
        onChanged={changed}
      />,
    );

    expect(await screen.findByRole("button", { name: "Максимум фото: 2" })).toBeDisabled();
    await userEvent.click(screen.getAllByRole("button", { name: "Открыть фото" })[0]);
    expect(await screen.findByRole("img", { name: "Фото дефекта" })).toHaveAttribute("src", "blob:photo");
    const preview = requests.find((r) => r.url.includes("/photos/p1/content?variant=preview"))!;
    expect(preview.headers.get("Authorization")).toBe("Bearer access-1");
    await userEvent.click(screen.getByRole("button", { name: "Удалить фото" }));

    await waitFor(() => expect(changed).toHaveBeenCalled());
  });

  it("explains a refusal of the server", async () => {
    fakeApi({ ...session, "POST /photos": () => problem(400, "IMAGE_DIMENSIONS_TOO_LARGE") });
    renderApp(
      <PhotoStrip propertyId="prop-1" observationId="obs-1" photoIds={[]} editable onChanged={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Добавить фото" })).toBeEnabled());

    await userEvent.upload(screen.getByLabelText("Выбрать фото"), jpeg());

    expect(await screen.findByText("Слишком большое разрешение фото")).toBeInTheDocument();
  });

  it("is hidden for a completed inspection without photos", () => {
    fakeApi(session);
    const { container } = renderApp(
      <PhotoStrip
        propertyId="prop-1"
        observationId="obs-1"
        photoIds={[]}
        editable={false}
        onChanged={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
