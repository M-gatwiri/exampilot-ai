"""Rule-based topic summaries derived from persisted quiz answer snapshots."""

MIN_TOPIC_ANSWERS = 3
WEAK_TOPIC_THRESHOLD = 70.0
STRONG_TOPIC_THRESHOLD = 80.0
TREND_CHANGE_THRESHOLD = 5.0


def build_performance_data(attempts):
    """Build the existing performance response plus evidence-based study insights."""
    history = []
    topic_totals = {}
    for attempt in attempts:
        question_results = attempt.question_results or []
        if not isinstance(question_results, list):
            question_results = []
        known_correct = sum(item.get('correct') is True for item in question_results if isinstance(item, dict))
        correct_answers = (
            known_correct
            if len(question_results) == attempt.total_questions
            else round(attempt.score * attempt.total_questions / 100)
        )

        for item in question_results:
            if not isinstance(item, dict):
                continue
            raw_domain = item.get('domain')
            domain = raw_domain.strip() if isinstance(raw_domain, str) and raw_domain.strip() else 'Uncategorized'
            summary = topic_totals.setdefault(domain, {'questions': 0, 'correct_answers': 0})
            summary['questions'] += 1
            summary['correct_answers'] += int(item.get('correct') is True)

        history.append({
            'id': attempt.id,
            'score': attempt.score,
            'correct_answers': correct_answers,
            'total_questions': attempt.total_questions,
            'completed_at': attempt.completed_at,
            'question_results': question_results,
            'review_available': len(question_results) == attempt.total_questions,
        })

    domains = [
        {
            'domain': domain,
            'questions': summary['questions'],
            'correct_answers': summary['correct_answers'],
            'score': round(summary['correct_answers'] / summary['questions'] * 100, 1),
        }
        for domain, summary in sorted(topic_totals.items())
    ]
    learning_insights = build_learning_insights(domains, history)
    return {'attempts': history, 'domains': domains, 'learning_insights': learning_insights}


def build_learning_insights(domains, history):
    """Apply documented thresholds and generate prioritized, score-backed actions."""
    topics = []
    for domain in domains:
        question_count = domain['questions']
        accuracy = domain['score']
        if question_count < MIN_TOPIC_ANSWERS:
            classification = 'insufficient_data'
        elif accuracy < WEAK_TOPIC_THRESHOLD:
            classification = 'focus'
        elif accuracy >= STRONG_TOPIC_THRESHOLD:
            classification = 'strength'
        else:
            classification = 'developing'
        topics.append({
            'topic': domain['domain'],
            'questions': question_count,
            'correct_answers': domain['correct_answers'],
            'accuracy': accuracy,
            'classification': classification,
        })

    trends = _build_trends(history)
    trend_by_topic = {trend['topic']: trend for trend in trends}
    for topic in topics:
        topic['trend'] = trend_by_topic.get(topic['topic'])

    focus_areas = sorted(
        (topic for topic in topics if topic['classification'] == 'focus'),
        key=lambda topic: (topic['accuracy'], -topic['questions'], topic['topic'].casefold()),
    )
    strengths = sorted(
        (topic for topic in topics if topic['classification'] == 'strength'),
        key=lambda topic: (-topic['accuracy'], -topic['questions'], topic['topic'].casefold()),
    )
    insufficient_topics = [topic for topic in topics if topic['classification'] == 'insufficient_data']
    developing_topics = [topic for topic in topics if topic['classification'] == 'developing']

    recommendations = []
    for topic in focus_areas:
        recommendations.append({
            'topic': topic['topic'],
            'priority': 'high',
            'accuracy': topic['accuracy'],
            'questions': topic['questions'],
            'correct_answers': topic['correct_answers'],
            'recommendation': (
                f"Prioritize {topic['topic']}: you answered {topic['correct_answers']} of "
                f"{topic['questions']} questions correctly ({topic['accuracy']}%). Review its core "
                'concepts, then try another AZ-900 practice quiz.'
            ),
        })
    for topic in developing_topics:
        recommendations.append({
            'topic': topic['topic'],
            'priority': 'medium',
            'accuracy': topic['accuracy'],
            'questions': topic['questions'],
            'correct_answers': topic['correct_answers'],
            'recommendation': (
                f"Keep building your {topic['topic']} knowledge: {topic['correct_answers']} of "
                f"{topic['questions']} answers are correct ({topic['accuracy']}%). Review missed "
                'questions and revisit this area in your next practice quiz.'
            ),
        })
    if not focus_areas and not developing_topics and strengths:
        best = strengths[0]
        recommendations.append({
            'topic': best['topic'],
            'priority': 'maintenance',
            'accuracy': best['accuracy'],
            'questions': best['questions'],
            'correct_answers': best['correct_answers'],
            'recommendation': (
                f"You are doing well in {best['topic']} ({best['accuracy']}% across "
                f"{best['questions']} answers). Keep your knowledge fresh with mixed practice."
            ),
        })
    for topic in insufficient_topics:
        recommendations.append({
            'topic': topic['topic'],
            'priority': 'more_data',
            'accuracy': topic['accuracy'],
            'questions': topic['questions'],
            'correct_answers': topic['correct_answers'],
            'recommendation': (
                f"Complete at least {MIN_TOPIC_ANSWERS} questions in {topic['topic']} before "
                'treating its score as a reliable study signal.'
            ),
        })

    topic_data_count = sum(topic['questions'] for topic in topics)
    reliable_topics = len(topics) - len(insufficient_topics)
    status = 'ready' if reliable_topics else 'insufficient_data'
    attempts_with_topic_data = sum(bool(attempt.get('question_results')) for attempt in history)
    if not topics:
        message = (
            'Saved quiz history does not include topic-level answers yet. Complete a practice quiz '
            'to start building your topic summary.'
        )
    elif not reliable_topics:
        message = (
            f'Complete at least {MIN_TOPIC_ANSWERS} questions in a topic before its performance '
            'can be assessed reliably.'
        )
    elif focus_areas:
        message = f"Start with {focus_areas[0]['topic']}, your current highest-priority focus area."
    elif developing_topics:
        message = 'Keep practicing the developing topics below to strengthen your understanding.'
    else:
        message = 'Your assessed topics are strengths. Keep them fresh with mixed practice.'

    if status == 'insufficient_data' and not topics and history:
        message += ' Older attempts without saved answers cannot be used for topic-level insights.'

    return {
        'status': status,
        'message': message,
        'minimum_answers_per_topic': MIN_TOPIC_ANSWERS,
        'weak_topic_threshold': WEAK_TOPIC_THRESHOLD,
        'strong_topic_threshold': STRONG_TOPIC_THRESHOLD,
        'attempts_analyzed': len(history),
        'attempts_with_topic_data': attempts_with_topic_data,
        'topic_answers_analyzed': topic_data_count,
        'topics': topics,
        'focus_areas': focus_areas,
        'strengths': strengths,
        'insufficient_topics': insufficient_topics,
        'trends': trends,
        'recommendations': recommendations,
    }


def _build_trends(history):
    """Compare each latest topic attempt with earlier saved answers when samples suffice."""
    attempts_oldest_first = list(reversed(history))
    by_topic = {}
    for attempt in attempts_oldest_first:
        per_topic = {}
        for item in attempt.get('question_results') or []:
            if not isinstance(item, dict):
                continue
            raw_domain = item.get('domain')
            topic = raw_domain.strip() if isinstance(raw_domain, str) and raw_domain.strip() else 'Uncategorized'
            summary = per_topic.setdefault(topic, {'questions': 0, 'correct_answers': 0})
            summary['questions'] += 1
            summary['correct_answers'] += int(item.get('correct') is True)
        for topic, summary in per_topic.items():
            by_topic.setdefault(topic, []).append(summary)

    trends = []
    for topic, attempts in sorted(by_topic.items()):
        latest = attempts[-1]
        earlier = attempts[:-1]
        previous_questions = sum(item['questions'] for item in earlier)
        previous_correct = sum(item['correct_answers'] for item in earlier)
        if latest['questions'] < MIN_TOPIC_ANSWERS or previous_questions < MIN_TOPIC_ANSWERS:
            continue
        latest_accuracy = round(latest['correct_answers'] / latest['questions'] * 100, 1)
        previous_accuracy = round(previous_correct / previous_questions * 100, 1)
        change = round(latest_accuracy - previous_accuracy, 1)
        if change > TREND_CHANGE_THRESHOLD:
            direction = 'improving'
        elif change < -TREND_CHANGE_THRESHOLD:
            direction = 'declining'
        else:
            direction = 'stable'
        trends.append({
            'topic': topic,
            'direction': direction,
            'change_percentage_points': change,
            'latest_accuracy': latest_accuracy,
            'latest_questions': latest['questions'],
            'previous_accuracy': previous_accuracy,
            'previous_questions': previous_questions,
        })
    return trends
