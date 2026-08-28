import { useMemo, useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { createSeededRandom } from '@/game/random/seededRandom';
import { generateNumericQuestion } from '@/quiz/generators/numericQuestion';

export default function QuizScreen() {
  const rng = useMemo(() => createSeededRandom(Date.now()), []);
  const [question, setQuestion] = useState(() => generateNumericQuestion(2, rng));
  const [answer, setAnswer] = useState('');
  const [message, setMessage] = useState('');

  const submit = () => {
    const value = Number(answer);
    setMessage(Number.isFinite(value) && value === question.answer ? 'Correct' : `Incorrect (answer: ${question.answer})`);
  };

  const next = () => {
    setQuestion(generateNumericQuestion(2, rng));
    setAnswer('');
    setMessage('');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Math quiz prototype</Text>
      <Text style={styles.question}>{question.prompt}</Text>
      <TextInput
        value={answer}
        onChangeText={setAnswer}
        keyboardType="numbers-and-punctuation"
        style={styles.input}
        placeholder="Answer"
      />
      <Button title="Check" onPress={submit} />
      <Button title="Next" onPress={next} />
      <Text>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 14 },
  heading: { fontSize: 22, fontWeight: '700' },
  question: { fontSize: 26, marginVertical: 16 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 20 },
});
