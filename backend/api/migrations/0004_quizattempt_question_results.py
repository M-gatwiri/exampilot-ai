from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0003_remove_userprofile_user_userprofile_email_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='quizattempt',
            name='question_results',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
