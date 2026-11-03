import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/lib/auth";
import { LibraryPublicationWorkspace } from "@/components/library-publication";
export default function LibraryPublicationPage() {
  const router = useRouter(),
    { session } = useAuth();
  const id = router.query.packageId;
  return (
    <Layout title="Yayına hazırla" compact>
      {session && typeof id === "string" && /^[a-f0-9-]{36}$/i.test(id) ? (
        <LibraryPublicationWorkspace
          key={session.user.id + id}
          user={session.user.id}
          id={id}
        />
      ) : (
        <p role="status">Kütüphaneden bir taslak paket seç.</p>
      )}
    </Layout>
  );
}
