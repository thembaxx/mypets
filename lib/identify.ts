import type { Species } from './care';
export interface BreedGuess {
  breed: string;
  confidence: number;
}
export async function identifyBreed(
  photo: string,
  species: Species,
  progress: (message: string) => void,
): Promise<BreedGuess[]> {
  progress('Preparing on-device recognition…');
  const { pipeline, env } = await import('@huggingface/transformers');
  env.allowLocalModels = false;
  const classifier = await pipeline('image-classification', 'onnx-community/mobilenet_v2_1.0_224', {
    device: 'wasm',
    dtype: 'fp32',
    progress_callback: (event: { status: string }) => {
      if (event.status === 'progress') progress('Downloading the recognition model…');
    },
  });
  progress('Looking at your pet…');
  const result = await classifier(photo, { top_k: 5 });
  await classifier.dispose();
  const guesses = result as { label: string; score: number }[];
  const cats: Record<string, string> = {
    tabby: 'Domestic Shorthair',
    'tiger cat': 'Domestic Shorthair',
    'Persian cat': 'Persian',
    'Siamese cat': 'Siamese',
    'Egyptian cat': 'Domestic Shorthair',
  };
  const rabbits: Record<string, string> = {
    'wood rabbit': 'Unknown',
    hare: 'Unknown',
    Angora: 'Angora',
  };
  return guesses
    .filter((g) => g.score >= 0.12)
    .flatMap((g) => {
      const label = g.label.split(',')[0];
      if (species === 'cat')
        return cats[label] ? [{ breed: cats[label], confidence: g.score }] : [];
      if (species === 'rabbit')
        return rabbits[label] && rabbits[label] !== 'Unknown'
          ? [{ breed: rabbits[label], confidence: g.score }]
          : [];
      const allowed =
        /retriever|terrier|shepherd|collie|poodle|spaniel|hound|beagle|husky|malamute|bulldog|Chihuahua|Shih-Tzu|dachshund|pug|boxer|Rottweiler|Dalmatian|Newfoundland|Bouvier|Doberman|Blenheim|papillon|Great Dane|Samoyed|Pekinese|Lhasa|Maltese|komondor|kuvasz|schipperke|whippet|basenji|kelpie|briard|vizsla|Leonberg|chow|dingo/i;
      if (!allowed.test(label)) return [];
      const breed = label
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .replace('German Shepherd', 'German Shepherd')
        .replace('Golden Retriever', 'Golden Retriever');
      return [{ breed, confidence: g.score }];
    })
    .filter((g, i, a) => a.findIndex((x) => x.breed === g.breed) === i);
}
