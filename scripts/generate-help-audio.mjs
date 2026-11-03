import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carrega .env.local
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...vals] = trimmed.split('=');
      if (key && vals.length > 0) {
        process.env[key.trim()] = vals.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
  }
}

const API_KEY = process.env.FISH_AUDIO_API_KEY;
if (!API_KEY) {
  console.error('Defina FISH_AUDIO_API_KEY no .env.local (ver .env.example).');
  process.exit(1);
}
const VOICE_ID = process.env.FISH_AUDIO_VOICE_ID || '1d8cb595b6284ff7aa7e8fec7b93249d';
const FORCE_REGENERATE = process.argv.includes('--force');
const TOUR_ARG = process.argv.find(a => a.startsWith('--tour=') || a.startsWith('--tours='));
const SELECTED_TOURS = TOUR_ARG ? TOUR_ARG.split('=')[1].split(',').map(s => s.trim()) : null;

function cleanHtmlToText(html) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function generateAudio(text, outputPath, retries = 3) {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Se não estiver em modo force e o arquivo já existe e tem tamanho > 1KB, pula
  if (!FORCE_REGENERATE && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1024) {
    console.log(`⏩ Já existe: ${path.basename(outputPath)}`);
    return;
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch('https://api.fish.audio/v1/tts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
          'model': 's2.1-pro-free',
        },
        body: JSON.stringify({
          text,
          reference_id: VOICE_ID,
          format: 'mp3',
          mp3_bitrate: 128,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        if (res.status === 429 && attempt < retries) {
          console.log(`\n⏳ Rate limit (429). Aguardando ${attempt * 2}s antes de tentar novamente...`);
          await new Promise(r => setTimeout(r, attempt * 2000));
          continue;
        }
        throw new Error(`Erro API (${res.status}): ${errorText}`);
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(outputPath, buffer);
      console.log(`✅ Gerado: ${path.basename(outputPath)} (${(buffer.length / 1024).toFixed(1)} KB)`);
      return;
    } catch (err) {
      if (attempt >= retries) throw err;
      console.log(`\n⚠️ Tentativa ${attempt} falhou: ${err.message}. Retentando...`);
      await new Promise(r => setTimeout(r, 1500));
    }
  }
}

// Extrai objetos TourDef dos arquivos TypeScript
function parseTourFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const tours = [];

  // Encontra declarações de export const tourX: TourDef = { ... }
  const tourRegex = /export\s+const\s+(\w+)\s*:\s*TourDef\s*=\s*\{([\s\S]*?)\n\};/g;
  let match;
  while ((match = tourRegex.exec(content)) !== null) {
    const tourBody = match[2];
    const idMatch = tourBody.match(/id\s*:\s*['"]([^'"]+)['"]/);
    const titleMatch = tourBody.match(/title\s*:\s*['"]([^'"]+)['"]/);
    
    if (idMatch) {
      const tourId = idMatch[1];
      const tourTitle = titleMatch ? titleMatch[1] : tourId;
      const steps = [];

      // Extrai passos
      const stepsSectionMatch = tourBody.match(/steps\s*:\s*\[([\s\S]*?)\]\s*,?\s*$/);
      if (stepsSectionMatch) {
        const stepsBlock = stepsSectionMatch[1];
        const stepObjRegex = /\{\s*id\s*:\s*['"]([^'"]+)['"][\s\S]*?title\s*:\s*['"]([^'"]+)['"][\s\S]*?text\s*:\s*([\s\S]*?)(?:,\s*element|,\s*on|,\s*route|,\s*desktopOnly|,\s*timeoutMs|\s*\})/g;
        
        let stepMatch;
        while ((stepMatch = stepObjRegex.exec(stepsBlock)) !== null) {
          const stepId = stepMatch[1];
          const stepTitle = stepMatch[2];
          let rawText = stepMatch[3].trim();
          
          // Limpa concatenações de strings JS
          let text = rawText
            .replace(/^['"`]|['"`]$/g, '')
            .replace(/['"`]\s*\+\s*['"`]/g, ' ')
            .replace(/\s+/g, ' ');

          steps.push({
            id: stepId,
            title: stepTitle,
            text: cleanHtmlToText(text),
          });
        }
      }

      tours.push({ id: tourId, title: tourTitle, steps });
    }
  }

  return tours;
}

async function main() {
  console.log('🎙️ Iniciando geração de áudios via Fish Audio...');
  console.log(`Voz selecionada: ${VOICE_ID}`);
  console.log(`API Key: ${API_KEY.slice(0, 10)}...${API_KEY.slice(-4)}`);

  const toursDir = path.resolve(__dirname, '../src/tour/tours');
  const outputBase = path.resolve(__dirname, '../public/audio/tours');

  const tourFiles = fs.readdirSync(toursDir).filter(f => f.endsWith('.ts'));
  let totalSteps = 0;
  const allTours = [];

  for (const file of tourFiles) {
    const fullPath = path.join(toursDir, file);
    const parsed = parseTourFile(fullPath);
    for (const t of parsed) {
      if (SELECTED_TOURS && !SELECTED_TOURS.includes(t.id)) continue;
      allTours.push(t);
      totalSteps += t.steps.length;
    }
  }

  console.log(`\n📚 Encontrados ${allTours.length} tours e ${totalSteps} passos no total.`);

  let processed = 0;
  let successCount = 0;
  let failCount = 0;

  for (const tour of allTours) {
    console.log(`\n▶️ Tour: "${tour.title}" (${tour.id}) - ${tour.steps.length} passos`);
    for (const step of tour.steps) {
      processed++;
      const spokenText = `${step.title}. ${step.text}`;
      const outputPath = path.join(outputBase, tour.id, `${step.id}.mp3`);

      try {
        process.stdout.write(`  [${processed}/${totalSteps}] Passo "${step.title}"... `);
        await generateAudio(spokenText, outputPath);
        successCount++;
        // Pequena pausa de 200ms para respeitar rate limits
        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        failCount++;
        console.error(`\n❌ Falha no passo "${step.id}":`, err.message);
      }
    }
  }

  console.log('\n=============================================');
  console.log(`✨ Concluído! ${successCount} áudios prontos | ${failCount} falhas`);
  console.log(`📁 Áudios salvos em: ${outputBase}`);
  console.log('=============================================\n');
}

main().catch(console.error);
