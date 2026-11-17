package com.trevotec.feedtec

import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import java.io.BufferedOutputStream
import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder

// FeedTec: corta gravação longa em pedaços de ~10 min num silêncio (pausa entre palavras) para o Gemini transcrever
// tudo — num pedido só ele parava por volta dos 10 min. Mesmo corte do site (cortar() em src/services/gemini.ts).
// Decodifica para PCM 16 kHz mono num arquivo temporário (não cabe em memória: 47 min ≈ 90 MB) e grava WAVs no cache.
class AudioModule(contexto: ReactApplicationContext) : ReactContextBaseJavaModule(contexto) {
  override fun getName() = NOME

  /** uri (file:// ou content://) → lista de file:// dos pedaços WAV, ou null se tiver até 12 min. */
  @ReactMethod
  fun cortar(uri: String, promise: Promise) {
    Thread {
      try { promise.resolve(cortarAgora(uri)) } catch (e: Exception) { promise.reject("audio", e.message, e) }
    }.start()
  }

  private fun cortarAgora(uri: String): WritableArray? {
    val dir = File(reactApplicationContext.cacheDir, "pedacos").apply { deleteRecursively(); mkdirs() }
    val pcm = File(dir, "tudo.pcm")
    decodificar(uri, pcm)
    val total = pcm.length() / 2
    if (total <= 12 * 60 * TAXA) { dir.deleteRecursively(); return null }
    val lista = Arguments.createArray()
    RandomAccessFile(pcm, "r").use { raf ->
      val cortes = mutableListOf(0L)
      // Sobra menor que 2 min vai junto no último pedaço.
      while (cortes.last() + JANELA < total - 2 * 60 * TAXA) cortes += silencio(raf, cortes.last() + JANELA)
      cortes += total
      for (i in 0 until cortes.size - 1) {
        val f = File(dir, "pedaco$i.wav")
        wav(raf, cortes[i], cortes[i + 1], f)
        lista.pushString(Uri.fromFile(f).toString())
      }
    }
    pcm.delete()
    return lista
  }

  private fun decodificar(uri: String, destino: File) {
    val ex = MediaExtractor()
    ex.setDataSource(reactApplicationContext, Uri.parse(uri), null)
    val faixa = (0 until ex.trackCount).first { ex.getTrackFormat(it).getString(MediaFormat.KEY_MIME)!!.startsWith("audio/") }
    ex.selectTrack(faixa)
    val fmt = ex.getTrackFormat(faixa)
    val codec = MediaCodec.createDecoderByType(fmt.getString(MediaFormat.KEY_MIME)!!)
    codec.configure(fmt, null, null, 0)
    codec.start()
    var taxa = fmt.getInteger(MediaFormat.KEY_SAMPLE_RATE).toLong()
    var canais = fmt.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
    val info = MediaCodec.BufferInfo()
    var fimEntrada = false
    // Reduz para 16 kHz tirando a média das amostras de cada intervalo (basta para voz).
    var soma = 0L; var n = 0; var pos = 0L
    try {
      BufferedOutputStream(FileOutputStream(destino), 1 shl 16).use { out ->
        while (true) {
          if (!fimEntrada) {
            val i = codec.dequeueInputBuffer(10_000)
            if (i >= 0) {
              val lidos = ex.readSampleData(codec.getInputBuffer(i)!!, 0)
              if (lidos < 0) { codec.queueInputBuffer(i, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM); fimEntrada = true }
              else { codec.queueInputBuffer(i, 0, lidos, ex.sampleTime, 0); ex.advance() }
            }
          }
          val o = codec.dequeueOutputBuffer(info, 10_000)
          if (o == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
            taxa = codec.outputFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE).toLong()
            canais = codec.outputFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
          } else if (o >= 0) {
            // ponytail: supõe PCM 16 bits (padrão dos decodificadores); tratar float se algum aparelho mandar.
            val s = codec.getOutputBuffer(o)!!.order(ByteOrder.LITTLE_ENDIAN).asShortBuffer()
            while (s.remaining() >= canais) {
              var m = 0
              repeat(canais) { m += s.get() }
              soma += m / canais; n++; pos += TAXA
              if (pos >= taxa) {
                pos -= taxa
                val v = (soma / n).toInt()
                out.write(v and 0xff); out.write((v shr 8) and 0xff)
                soma = 0; n = 0
              }
            }
            codec.releaseOutputBuffer(o, false)
            if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) break
          }
        }
      }
    } finally { codec.stop(); codec.release(); ex.release() }
  }

  /** Meio da janela de 0,3 s mais quieta em ±15 s do alvo (0,3 s para não cair no silêncio de dentro de uma palavra). */
  private fun silencio(raf: RandomAccessFile, alvo: Long): Long {
    val ini = alvo - 15 * TAXA
    val q = (TAXA * 3 / 10).toInt(); val passo = (TAXA / 20).toInt(); val largura = (30 * TAXA).toInt()
    val bytes = ByteArray((largura + q) * 2)
    raf.seek(ini * 2); raf.readFully(bytes)
    val s = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN).asShortBuffer()
    var melhor = alvo; var menor = Double.MAX_VALUE
    for (k in 0 until largura step passo) {
      var e = 0.0
      for (i in k until k + q) { val x = s.get(i).toDouble(); e += x * x }
      if (e < menor) { menor = e; melhor = ini + k + q / 2 }
    }
    return melhor
  }

  private fun wav(raf: RandomAccessFile, de: Long, ate: Long, destino: File) {
    val tam = ((ate - de) * 2).toInt()
    val h = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN)
    h.put("RIFF".toByteArray()).putInt(36 + tam).put("WAVEfmt ".toByteArray()).putInt(16).putShort(1).putShort(1)
      .putInt(TAXA.toInt()).putInt(TAXA.toInt() * 2).putShort(2).putShort(16).put("data".toByteArray()).putInt(tam)
    BufferedOutputStream(FileOutputStream(destino), 1 shl 16).use { out ->
      out.write(h.array())
      raf.seek(de * 2)
      val buf = ByteArray(1 shl 16)
      var falta = tam
      while (falta > 0) { val l = raf.read(buf, 0, minOf(buf.size, falta)); out.write(buf, 0, l); falta -= l }
    }
  }

  companion object {
    const val NOME = "FeedTecAudio"
    const val TAXA = 16_000L // o Gemini reduz o áudio a 16 kHz de qualquer jeito
    const val JANELA = 10 * 60 * TAXA
  }
}

class AudioPackage : BaseReactPackage() {
  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == AudioModule.NOME) AudioModule(reactContext) else null

  override fun getReactModuleInfoProvider() = ReactModuleInfoProvider {
    mapOf(AudioModule.NOME to ReactModuleInfo(AudioModule.NOME, AudioModule::class.java.name, false, false, false, false))
  }
}
