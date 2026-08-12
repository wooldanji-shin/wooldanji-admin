import { PremiumFormView } from '../../_form/PremiumFormView';

export default async function PremiumEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PremiumFormView premiumId={id} />;
}
