import { AdFormView } from '../../_form/AdFormView';

export default async function AdEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdFormView adId={id} />;
}
