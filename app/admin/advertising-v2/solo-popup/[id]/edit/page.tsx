import { SoloPopupFormView } from '../../_form/SoloPopupFormView';

export default async function SoloPopupEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SoloPopupFormView soloId={id} />;
}
