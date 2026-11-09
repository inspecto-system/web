import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setAccessToken } from "@/auth/session";
import { DefectForm } from "@/inspections/defect-form";
import { fakeApi, json, renderApp, tokens, user, type Routes } from "@/testing/render";

const categories = [
  { id: "cat-paint", name: "Покраска", system: true, active: true, elementGroup: "WALLS" },
  { id: "cat-crack", name: "Трещина", system: true, active: true, elementGroup: "WINDOWS" },
  { id: "cat-stain", name: "Пятно", system: true, active: true, elementGroup: "CEILING" },
];
const session: Routes = {
  "POST /auth/refresh": () => json(200, tokens),
  "GET /users/me": () => json(200, user),
  "GET /defect-categories": () => json(200, categories),
  "GET /photos/limits": () =>
    json(200, {
      allowedContentTypes: ["image/jpeg"],
      maxFileSizeBytes: 1024,
      maxPixels: 1_000_000,
      maxPhotosPerObservation: 10,
    }),
  "POST /photos": () => json(201, { id: "photo-1" }),
};
const jpeg = new File(["x"], "crack.jpg", { type: "image/jpeg" });

beforeEach(() => setAccessToken(null));

function form(onSubmit = vi.fn().mockResolvedValue(undefined)) {
  renderApp(<DefectForm propertyId="prop-1" roomId="room-1" onSubmit={onSubmit} onCancel={vi.fn()} />);
  return onSubmit;
}

async function upload() {
  await waitFor(() => expect(screen.getByRole("button", { name: "Добавить фото дефекта" })).toBeEnabled());
  await userEvent.upload(screen.getByLabelText("Выбрать фото дефекта"), jpeg);
}

describe("DefectForm with a photo (T-603)", () => {
  it("suggests categories for the photo, preselects the first and sends the suggestion and photo", async () => {
    const { requests } = fakeApi({
      ...session,
      "POST /category-suggestions": () =>
        json(200, {
          suggestionId: "sug-1",
          modelVersion: "m1",
          items: [
            { categoryId: "cat-crack", code: "CRACK", name: "Трещина", probability: 0.81 },
            { categoryId: "cat-stain", code: "STAIN", name: "Пятно", probability: 0.12 },
          ],
        }),
    });
    const submit = form();
    await upload();

    const top = await screen.findByRole("button", { name: "Трещина — 81 %" });
    expect(top).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Категория")).toHaveValue("cat-crack");
    await userEvent.click(screen.getByRole("button", { name: "Пятно — 12 %" }));
    expect(screen.getByLabelText("Категория")).toHaveValue("cat-stain");
    await userEvent.type(screen.getByLabelText("Описание дефекта кратко"), "Пятно на потолке");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить дефект" }));

    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: "cat-stain", suggestionId: "sug-1", title: "Пятно на потолке" }),
      "photo-1",
    );
    const asked = requests.find((r) => r.url.endsWith("/category-suggestions"))!;
    expect(await asked.json()).toEqual({ photoId: "photo-1" });
  });

  it("works without a suggestion: the photo is still sent, no suggestionId", async () => {
    fakeApi({ ...session, "POST /category-suggestions": () => json(200, { items: [] }) });
    const submit = form();
    await upload();

    expect(await screen.findByText(/Подсказки нет/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Описание дефекта кратко"), "Скол");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить дефект" }));

    await waitFor(() => expect(submit).toHaveBeenCalled());
    const [defect, photoId] = submit.mock.calls[0] as [Record<string, unknown>, string];
    expect(defect.suggestionId).toBeUndefined();
    expect(photoId).toBe("photo-1");
  });

  it("sends neither photo nor suggestion when no photo was taken", async () => {
    fakeApi(session);
    const submit = form();
    await waitFor(() => expect(screen.getByLabelText("Категория")).toHaveValue("cat-paint"));

    await userEvent.type(screen.getByLabelText("Описание дефекта кратко"), "Трещина");
    await userEvent.click(screen.getByRole("button", { name: "Сохранить дефект" }));

    await waitFor(() => expect(submit).toHaveBeenCalled());
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ suggestionId: undefined }), undefined);
  });
});
