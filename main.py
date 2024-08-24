import configparser
import requests
from datetime import datetime

from sdvx import get_login_token, get_raw_sdvx_scores, clean_scores
from kamaitachi import import_scores


def notify(*args, **kwargs) -> None:
    """
    Wrapper for ``print()`` that adds a timestamp prefix to the message.
    """
    current_time = datetime.now()
    formatted_time = current_time.strftime('%H:%M:%S')
    prefix = f'[{formatted_time}]'

    print(prefix, *args, **kwargs)


def main() -> None:
    # get user credentials
    config = configparser.ConfigParser()
    config.read('config.ini')

    try:
        username = config.get('credentials', 'username')
        password = config.get('credentials', 'password')
        api_key = config.get('credentials', 'api_key')

        # all three fields are required
        if not all([username, password, api_key]):
            raise Exception('Missing one or more credentials.')

    except Exception as e:
        print('Error:', e)
        print('Make sure config.ini is set up properly!')
        return

    # query the konami api for the user's sdvx scores
    with requests.Session() as s:
        login_token = get_login_token(s, username, password)
        notify('Successfully logged in to the KONAMI service.')

        scores_raw = get_raw_sdvx_scores(s, login_token)

    scores_clean = clean_scores(scores_raw)
    num_scores = len(scores_clean)
    while True:
        notify(f'Found {num_scores} scores. Import to Kamaitachi? (y/n)',
               end=' ')

        response = input()
        if response == 'y':
            break
        elif response == 'n':
            notify('Cancelled operation.')
            return

    # create the batch-manual json
    batch_manual = {
        'meta': {
            'game': 'sdvx',
            'playtype': 'Single',
            'service': 'kt-sdvx-eamuse-importer'
        },
        'scores': scores_clean
    }

    # import to kamaitachi
    notify('Importing...')
    n_new_scores, n_sessions, n_errors = import_scores(api_key, batch_manual)
    notify(f'Imported {n_new_scores} new scores and created '
           f'{n_sessions} sessions with {n_errors} errors!')


if __name__ == '__main__':
    main()
