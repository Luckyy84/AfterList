import type { MediaSource, MediaType } from '../types/media'

export type SearchCatalogItem = {
  externalId: string
  source: MediaSource
  title: string
  type: MediaType
  year: string
  poster: string
  backdrop: string
  rating: string
  description: string
}

export const searchCatalog: SearchCatalogItem[] = [
  {
    externalId: 'dune-part-two-2024',
    source: 'mock-api',
    title: 'Dune: Part Two',
    type: 'Movie',
    year: '2024',
    poster: 'https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fposterspy.com%2Fwp-content%2Fuploads%2F2023%2F06%2FDunePT2_Poster004-1200x1762.jpg&f=1&nofb=1&ipt=9e933dbd79d71f941c8eb7cbda2576c09017da68cb057979c763188e68c015a4',
    backdrop: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1800&q=80',
    rating: '9.1',
    description: 'Paul Atreides unites with Chani and the Fremen while seeking revenge against the people who destroyed his family.',
  },
  {
    externalId: 'dune-2021',
    source: 'mock-api',
    title: 'Dune',
    type: 'Movie',
    year: '2021',
    poster: 'https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fwww.themoviedb.org%2Ft%2Fp%2Foriginal%2Fd5NXSklXo0qyIYkgV94XAgMIckC.jpg&f=1&nofb=1&ipt=bf271155d6a71981035a49af35d62d4af05660394e53915cbd5c7fb24771a2a1',
    backdrop: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1800&q=80',
    rating: '8.6',
    description: 'A noble family becomes involved in a war for control over the galaxy’s most valuable desert planet.',
  },
  {
    externalId: 'dune-prophecy-2024',
    source: 'mock-api',
    title: 'Dune: Prophecy',
    type: 'TV Series',
    year: '2024',
    poster: 'https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fstatic1.colliderimages.com%2Fwordpress%2Fwp-content%2Fuploads%2F2024%2F10%2Fdune-prophecy-poster.jpg&f=1&nofb=1&ipt=bcc301105fb4d25d9a78b41990d73fcda573f25e77f6534fb85fd22369e03afc',
    backdrop: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1800&q=80',
    rating: '7.5',
    description: 'A prequel series exploring the origins of the Bene Gesserit and the political power behind the Imperium.',
  },
  {
    externalId: 'dune-1984',
    source: 'mock-api',
    title: 'Dune',
    type: 'Movie',
    year: '1984',
    poster: 'https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fwww.themoviedb.org%2Ft%2Fp%2Foriginal%2FngUaHgSZGkKy1Izwjk7qwZLOC5A.jpg&f=1&nofb=1&ipt=2b48d18b872b3f68d208b622056f9594e3ba8447d567b71278895a11e03d8f3c',
    backdrop: 'https://images.unsplash.com/photo-1473186578172-c141e6798cf4?auto=format&fit=crop&w=1800&q=80',
    rating: '6.7',
    description: 'The cult sci-fi adaptation about politics, prophecy, spice, and survival on Arrakis.',
  },
  {
    externalId: 'interstellar-2014',
    source: 'mock-api',
    title: 'Interstellar',
    type: 'Movie',
    year: '2014',
    poster: 'https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fi.pinimg.com%2Foriginals%2F8e%2F0d%2Fab%2F8e0dab8699be85720ce55845065bf6dc.jpg&f=1&nofb=1&ipt=0b6e616895cb74719d29eb0dc463ad6732a9c13b456bdbc091b23b14ebb831df',
    backdrop: 'https://images.unsplash.com/photo-1446776877081-d282a0f896e2?auto=format&fit=crop&w=1800&q=80',
    rating: '9.7',
    description: 'A space exploration movie about time, survival, family, and impossible choices.',
  },
  {
    externalId: 'attack-on-titan-2013',
    source: 'mock-api',
    title: 'Attack on Titan',
    type: 'Anime',
    year: '2013',
    poster: 'https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Fstatic0.gamerantimages.com%2Fwordpress%2Fwp-content%2Fuploads%2F2023%2F09%2Fattack-on-titan.jpg&f=1&nofb=1&ipt=21e760be01c961cd067f0a5effa78a44dd13b7365c50e9dcea9ca4c307527ef3',
    backdrop: 'https://images.unsplash.com/photo-1560942485-b2a11cc13456?auto=format&fit=crop&w=1800&q=80',
    rating: '9.0',
    description: 'Humanity fights for survival against giant humanoid monsters hidden behind massive stone walls.',
  },
]
