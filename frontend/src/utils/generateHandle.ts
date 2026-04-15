export const generateHandle = (): string => {
  const adjectives = ['Silent', 'Quiet', 'Swift', 'Brave', 'Clever', 'Bright', 'Calm', 'Neon'];
  const animals = ['Owl', 'Eagle', 'Fox', 'Wolf', 'Bear', 'Hawk', 'Tiger', 'Lynx'];
  const randomAdj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomAnimal = animals[Math.floor(Math.random() * animals.length)];
  const randomNumber = Math.floor(1000 + Math.random() * 9000);
  
  return `${randomAdj}${randomAnimal}#${randomNumber}`;
};