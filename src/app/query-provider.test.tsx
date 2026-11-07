import { useQueryClient } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QueryProvider } from "@/app/query-provider";

function Retries() {
  const options = useQueryClient().getDefaultOptions().queries;
  return <p>{`retry=${String(options?.retry)} focus=${String(options?.refetchOnWindowFocus)}`}</p>;
}

describe("QueryProvider", () => {
  it("provides one query client with conservative retries", () => {
    render(
      <QueryProvider>
        <Retries />
      </QueryProvider>,
    );

    expect(screen.getByText("retry=1 focus=false")).toBeInTheDocument();
  });
});
