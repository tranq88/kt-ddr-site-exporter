import requests
import time


IMPORT_ENDPOINT = 'https://kamai.tachi.ac/ir/direct-manual/import'


def raise_kt_api_error(kt_api_response: dict) -> None:
    """
    Raise an error if a Kamaitachi API request was unsuccessful.
    :param kt_api_response: The response from Kamaitachi.
    """
    if not kt_api_response['success']:
        raise Exception(f"Kamaitachi API: {kt_api_response['description']}")


def validate_import_status(import_url: str) -> dict:
    """
    Validate the import status of a Kamaitachi score import and return a
    response where the ``success`` field is always ``True``.
    :param import_url: The score import URL.
    :return: The import status response returned by Kamaitachi.
    """
    r = requests.get(import_url)
    response = r.json()

    # this guarantees that the import is valid
    raise_kt_api_error(response)

    return response


def import_scores(api_key: str, batch_manual: dict) -> tuple[int, int, int]:
    """
    Import the scores in a BATCH-MANUAL JSON to Kamaitachi.
    :param api_key: The user's API key.
    :param batch_manual: The BATCH-MANUAL JSON.
    :return: A tuple of the form (# of new scores, # of sessions, # of errors).
    """
    headers = {
        'Authorization': f'Bearer {api_key}',
        'X-User-Intent': 'true'
    }
    r = requests.post(IMPORT_ENDPOINT, headers=headers, json=batch_manual)

    response = r.json()
    raise_kt_api_error(response)

    # wait until the import is complete before returning
    import_status_url = response['body']['url']
    while True:
        status_response = validate_import_status(import_status_url)

        status = status_response['body']['importStatus']
        if status == 'completed':
            n_new_scores = len(status_response['body']['import']['scoreIDs'])
            n_sessions = len(
                status_response['body']['import']['createdSessions']
            )
            n_errors = len(status_response['body']['import']['errors'])

            return n_new_scores, n_sessions, n_errors

        time.sleep(1)  # poll the status every second
