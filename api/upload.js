// Ce fichier doit être placé dans : /api/upload.js

import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

// Configuration importante pour que le fichier soit correctement traité
export const config = {
  api: {
    bodyParser: false,
  },
};

// C'est la fonction qui sera appelée quand votre site fera une requête vers /api/upload
export default async function handler(request) {
  // On récupère le nom du fichier depuis l'URL de la requête
  const { searchParams } = new URL(request.url);
  const filename = searchParams.get('filename');

  // Sécurité : on vérifie qu'il y a bien un nom de fichier et un corps de requête
  if (!filename || !request.body) {
    return new NextResponse(JSON.stringify({ message: 'Aucun fichier à envoyer.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // On envoie le fichier vers Vercel Blob.
  // `request.body` est le fichier lui-même.
  // `access: 'public'` rend le fichier accessible publiquement via une URL.
  const blob = await put(filename, request.body, {
    access: 'public',
  });

  // On renvoie les informations du fichier (surtout son URL permanente) au format JSON
  return NextResponse.json(blob);
}
