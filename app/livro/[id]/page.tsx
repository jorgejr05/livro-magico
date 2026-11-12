import { BookPage } from "@/components/BookPage";

export const metadata = { title: "Seu livro · Livro Mágico" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BookPage id={id} />;
}
